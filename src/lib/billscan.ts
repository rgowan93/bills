import { parse as parseDate, isValid } from 'date-fns'
import type { BillCategory, Recurrence } from './types'

export interface ParsedBill {
  name?: string
  amount?: number
  nextDue?: string        // ISO
  category?: BillCategory
  account?: string
  recurrence?: Recurrence
  confidence: number      // 0-1 OCR confidence
  rawText: string
  found: { name: boolean; amount: boolean; date: boolean }
}

/** Run OCR on one or more images (pages of a bill) and parse the combined text. */
export async function scanBill(files: File[], onProgress?: (p: number) => void): Promise<ParsedBill> {
  const Tesseract = (await import('tesseract.js')).default
  let combined = ''
  let confSum = 0
  for (let i = 0; i < files.length; i++) {
    const { data } = await Tesseract.recognize(files[i], 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress((i + m.progress) / files.length)
        }
      }
    })
    combined += '\n' + data.text
    confSum += (data.confidence ?? 0)
  }
  const parsed = parseBillText(combined)
  parsed.confidence = files.length ? confSum / files.length / 100 : 0
  return parsed
}

/* ---------------- biller / category dictionaries ---------------- */

interface BillerRule { keywords: string[]; name: string; category: BillCategory; recurrence?: Recurrence }

const BILLERS: BillerRule[] = [
  { keywords: ['fpl', 'florida power', 'power & light', 'power and light'], name: 'FPL Electric', category: 'utilities' },
  { keywords: ['duke energy'], name: 'Duke Energy', category: 'utilities' },
  { keywords: ['georgia power', 'dominion', 'pg&e', 'pge', 'con edison', 'coned', 'national grid', 'xcel', 'entergy', 'aep', 'pep co'], name: 'Electric', category: 'utilities' },
  { keywords: ['electric', 'power company', 'energy', 'kwh', 'utilit'], name: 'Electric', category: 'utilities' },
  { keywords: ['water', 'sewer', 'aqua'], name: 'Water', category: 'utilities' },
  { keywords: ['gas company', 'natural gas', 'piedmont'], name: 'Gas', category: 'utilities' },
  { keywords: ['comcast', 'xfinity', 'spectrum', 'cox', 'fiber', 'internet', 'broadband', 'frontier', 'centurylink'], name: 'Internet', category: 'utilities' },
  { keywords: ['at&t', 'att ', 'verizon', 't-mobile', 'tmobile', 'sprint', 'cricket', 'mint mobile', 'wireless', 'cellular'], name: 'Phone', category: 'utilities' },
  { keywords: ['geico', 'progressive', 'allstate', 'state farm', 'liberty mutual', 'nationwide', 'usaa', 'insurance', 'policy premium'], name: 'Insurance', category: 'insurance' },
  { keywords: ['mortgage', 'rocket mortgage', 'wells fargo home', 'loan servicing'], name: 'Mortgage', category: 'housing' },
  { keywords: ['rent', 'property management', 'apartments', 'leasing', 'hoa'], name: 'Rent / Housing', category: 'housing' },
  { keywords: ['toyota financial', 'honda financial', 'ally', 'capital one auto', 'auto loan', 'car payment', 'vehicle'], name: 'Car Payment', category: 'transport' },
  { keywords: ['netflix', 'hulu', 'spotify', 'disney', 'youtube premium', 'hbo', 'max ', 'paramount', 'peacock', 'apple tv', 'membership', 'subscription'], name: 'Subscription', category: 'subscription' },
  { keywords: ['visa', 'mastercard', 'amex', 'american express', 'discover', 'credit card', 'card services', 'chase card'], name: 'Credit Card', category: 'debt' },
  { keywords: ['hospital', 'medical', 'clinic', 'dental', 'pharmacy', 'health'], name: 'Medical', category: 'health' }
]

const CURRENCY = /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})/g
const AMOUNT_LABELS = [
  'total amount you owe', 'total amount due', 'pay this amount', 'amount you owe',
  'total amount', 'new balance', 'balance due', 'amount due', 'please pay',
  'minimum payment due', 'total new charges', 'current charges', 'total due'
]
const SKIP_AMOUNT_HINTS = ['instead of', 'last bill', 'received', 'thank you', 'autopay', 'budget billing', 'past due balance', 'late payment charge']
const DUE_LABELS = ['new charges due by', 'payment due by', 'due date', 'due by', 'payment due', 'autopay date', 'due']

function toNumber(s: string): number { return parseFloat(s.replace(/[^0-9.]/g, '')) }

function currencyInWindow(lines: string[], idx: number, radius = 2): number | null {
  const cands: { val: number; dist: number; line: string }[] = []
  for (let d = -radius; d <= radius; d++) {
    const li = idx + d
    if (li < 0 || li >= lines.length) continue
    const line = lines[li]
    const low = line.toLowerCase()
    if (SKIP_AMOUNT_HINTS.some(h => low.includes(h))) continue
    const matches = line.match(CURRENCY)
    if (matches) for (const m of matches) {
      const v = toNumber(m)
      if (v > 0 && v < 1_000_000) cands.push({ val: v, dist: Math.abs(d), line })
    }
  }
  if (!cands.length) return null
  cands.sort((a, b) => a.dist - b.dist || b.val - a.val)
  return cands[0].val
}

function parseDateString(raw: string): Date | null {
  const cleaned = raw.trim()
  const fmts = ['MMM d, yyyy', 'MMMM d, yyyy', 'MMM d yyyy', 'MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd', 'M/d/yy', 'MM/dd/yy']
  for (const f of fmts) {
    const d = parseDate(cleaned, f, new Date())
    if (isValid(d) && d.getFullYear() > 2000 && d.getFullYear() < 2100) return d
  }
  return null
}

const DATE_RX = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})|(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(\b\d{4}-\d{2}-\d{2}\b)/i

function dateInWindow(lines: string[], idx: number, radius = 1): Date | null {
  for (let d = 0; d <= radius; d++) {
    for (const li of [idx - d, idx + d]) {
      if (li < 0 || li >= lines.length) continue
      const m = lines[li].match(DATE_RX)
      if (m) { const dt = parseDateString(m[0]); if (dt) return dt }
    }
  }
  return null
}

export function parseBillText(text: string): ParsedBill {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const low = text.toLowerCase()
  const out: ParsedBill = { confidence: 0, rawText: text, recurrence: 'monthly', found: { name: false, amount: false, date: false } }

  // ---- biller name + category ----
  for (const rule of BILLERS) {
    if (rule.keywords.some(k => low.includes(k))) {
      out.name = rule.name; out.category = rule.category
      if (rule.recurrence) out.recurrence = rule.recurrence
      out.found.name = true
      break
    }
  }
  if (!out.name) {
    // fallback: first prose line that looks like a company/name
    const cand = lines.find(l => /[a-zA-Z]{3,}/.test(l) && l.length <= 32 && !/\d{4}/.test(l) && !/(statement|account|page|hello|invoice)/i.test(l))
    if (cand) { out.name = cand.replace(/[^\w &.-]/g, '').trim().slice(0, 32); out.found.name = !!out.name }
    out.category = out.category ?? 'other'
  }

  // ---- amount (label-anchored, falls back to a sensible total) ----
  let amount: number | null = null
  outer: for (const label of AMOUNT_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(label)) {
        const v = currencyInWindow(lines, i, 2)
        if (v != null) { amount = v; break outer }
      }
    }
  }
  if (amount == null) {
    // last resort: the largest 2-decimal currency that isn't a payment/credit line
    const all: number[] = []
    for (const l of lines) {
      const low2 = l.toLowerCase()
      if (SKIP_AMOUNT_HINTS.some(h => low2.includes(h))) continue
      const m = l.match(/\$\s?\d{1,3}(?:,\d{3})*\.\d{2}/g)
      if (m) m.forEach(x => all.push(toNumber(x)))
    }
    if (all.length) amount = Math.max(...all)
  }
  if (amount != null) { out.amount = Math.round(amount * 100) / 100; out.found.amount = true }

  // ---- due date ----
  let due: Date | null = null
  for (const label of DUE_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(label)) {
        const dt = dateInWindow(lines, i, 1)
        if (dt) { due = dt; break }
      }
    }
    if (due) break
  }
  if (due) { out.nextDue = startOfDayISO(due); out.found.date = true }

  // ---- account number ----
  const acct = text.match(/account\s*(?:number|no\.?|#)?\s*[:#]?\s*([0-9][0-9\- ]{4,}[0-9])/i)
  if (acct) out.account = acct[1].replace(/\s+/g, '').trim()

  // ---- recurrence hints ----
  if (/\b(annual|yearly|per year|12[- ]month term)\b/i.test(low)) out.recurrence = 'yearly'
  else if (/\b(quarter|quarterly)\b/i.test(low)) out.recurrence = 'quarterly'

  return out
}

function startOfDayISO(d: Date): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString()
}
