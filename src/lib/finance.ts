import {
  addDays, addWeeks, addMonths, addQuarters, addYears,
  differenceInCalendarDays, isBefore, parseISO, startOfDay, format
} from 'date-fns'
import type {
  AppState, Bill, Recurrence, Holding, CreditAccount, Goal
} from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n || 0)

export const compactMoney = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function advance(date: Date, r: Recurrence): Date {
  switch (r) {
    case 'weekly': return addWeeks(date, 1)
    case 'biweekly': return addWeeks(date, 2)
    case 'monthly': return addMonths(date, 1)
    case 'quarterly': return addQuarters(date, 1)
    case 'yearly': return addYears(date, 1)
    default: return addYears(date, 100)
  }
}

/** Roll a bill's nextDue forward until it is today or in the future. */
export function normalizeBill(bill: Bill): Bill {
  if (bill.recurrence === 'once') return bill
  let next = startOfDay(parseISO(bill.nextDue))
  const today = startOfDay(new Date())
  let guard = 0
  while (isBefore(next, today) && guard < 600) { next = advance(next, bill.recurrence); guard++ }
  return { ...bill, nextDue: next.toISOString() }
}

export interface UpcomingBill { bill: Bill; due: Date; daysUntil: number }

export function upcomingBills(bills: Bill[], horizonDays = 45): UpcomingBill[] {
  const today = startOfDay(new Date())
  return bills
    .map(b => {
      const due = startOfDay(parseISO(b.nextDue))
      return { bill: b, due, daysUntil: differenceInCalendarDays(due, today) }
    })
    .filter(u => u.daysUntil <= horizonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

/** Monthly-equivalent cost of any recurring amount. */
export function monthlyEquivalent(amount: number, r: Recurrence): number {
  switch (r) {
    case 'weekly': return amount * 52 / 12
    case 'biweekly': return amount * 26 / 12
    case 'monthly': return amount
    case 'quarterly': return amount / 3
    case 'yearly': return amount / 12
    case 'once': return 0
  }
}

export function monthlyBillTotal(bills: Bill[]): number {
  return bills.reduce((s, b) => s + monthlyEquivalent(b.amount, b.recurrence), 0)
}

export function monthlyIncome(s: AppState): number {
  const explicit = s.income.reduce((sum, i) => sum + monthlyEquivalent(i.amount, i.recurrence), 0)
  if (explicit > 0) return explicit
  const avgWeekly = (s.settings.weeklyIncomeLow + s.settings.weeklyIncomeHigh) / 2
  return avgWeekly * 52 / 12
}

/**
 * "How much do I need in my bills account?" — sum of every bill instance due
 * within `days`, so the user always knows the exact buffer to keep funded.
 */
export function fundingNeeded(bills: Bill[], days: number): number {
  const today = startOfDay(new Date())
  const horizon = addDays(today, days)
  let total = 0
  for (const b of bills) {
    let cursor = startOfDay(parseISO(b.nextDue))
    let guard = 0
    while (!isBefore(horizon, cursor) && guard < 400) {
      total += b.amount
      if (b.recurrence === 'once') break
      cursor = advance(cursor, b.recurrence)
      guard++
    }
  }
  return total
}

/** Recommended per-paycheck set-aside given pay cadence. */
export function setAsidePerPaycheck(monthlyBills: number, cadence: Recurrence): number {
  switch (cadence) {
    case 'weekly': return monthlyBills * 12 / 52
    case 'biweekly': return monthlyBills * 12 / 26
    case 'monthly': return monthlyBills
    default: return monthlyBills
  }
}

export interface PaymentScore {
  total: number; onTime: number; rate: number; streak: number; grade: string
}

export function paymentScore(bills: Bill[]): PaymentScore {
  let total = 0, onTime = 0
  const events: { date: string; onTime: boolean }[] = []
  for (const b of bills) {
    for (const [due, p] of Object.entries(b.payments)) {
      total++; if (p.onTime) onTime++
      events.push({ date: due, onTime: p.onTime })
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const e of events) { if (e.onTime) streak++; else break }
  const rate = total ? onTime / total : 1
  const grade = rate >= 0.99 ? 'A+' : rate >= 0.95 ? 'A' : rate >= 0.9 ? 'B' : rate >= 0.8 ? 'C' : 'D'
  return { total, onTime, rate, streak, grade }
}

/* ---------------- Credit ---------------- */

export function creditUtilization(accounts: CreditAccount[]): { overall: number; perCard: { name: string; util: number }[]; totalBalance: number; totalLimit: number } {
  const cards = accounts.filter(a => a.type === 'credit-card')
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0)
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0)
  const perCard = cards.map(c => ({ name: c.name, util: c.limit ? c.balance / c.limit : 0 }))
  return { overall: totalLimit ? totalBalance / totalLimit : 0, perCard, totalBalance, totalLimit }
}

/**
 * Educational FICO-style estimator. Real scores use proprietary models — this
 * approximates the well-known category weights to show the *direction* of impact.
 */
export function estimateCreditScore(state: AppState): { score: number; factors: { label: string; impact: number; tip: string }[] } {
  const { creditAccounts } = state
  const ps = paymentScore(state.bills)
  const util = creditUtilization(creditAccounts).overall

  // Payment history 35%
  const payment = ps.total === 0 ? 0.9 : ps.rate
  // Utilization 30% — best under 10%, harsh above 30%
  const utilScore = util <= 0.09 ? 1 : util <= 0.3 ? 1 - (util - 0.09) * 1.2 : Math.max(0, 0.74 - (util - 0.3) * 1.4)
  // Age of credit 15%
  const ages = creditAccounts.filter(a => a.openedAt).map(a => differenceInCalendarDays(new Date(), parseISO(a.openedAt!)) / 365)
  const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 1
  const ageScore = Math.min(1, avgAge / 8)
  // Mix 10%
  const types = new Set(creditAccounts.map(a => a.type))
  const mixScore = Math.min(1, types.size / 3)
  // New credit / inquiries proxy 10% — accounts opened < 1y
  const recent = creditAccounts.filter(a => a.openedAt && differenceInCalendarDays(new Date(), parseISO(a.openedAt!)) < 365).length
  const inquiryScore = Math.max(0, 1 - recent * 0.25)

  const composite = payment * 0.35 + utilScore * 0.30 + ageScore * 0.15 + mixScore * 0.10 + inquiryScore * 0.10
  const score = Math.round(300 + composite * 550)

  const factors = [
    { label: 'Payment history', impact: payment, tip: payment >= 0.99 ? 'Flawless — keep autopay on.' : 'One late payment can drop you 80+ pts. Never miss a due date.' },
    { label: 'Credit utilization', impact: utilScore, tip: util > 0.1 ? `You're at ${(util * 100).toFixed(0)}%. Get every card under 10% before the statement closes.` : 'Excellent — under 10%.' },
    { label: 'Age of credit', impact: ageScore, tip: avgAge < 5 ? 'Keep oldest cards open forever — never close them.' : 'Strong, aged accounts.' },
    { label: 'Credit mix', impact: mixScore, tip: types.size < 2 ? 'A mix of revolving + installment helps. Don\'t open accounts just for this though.' : 'Good variety.' },
    { label: 'New inquiries', impact: inquiryScore, tip: recent > 0 ? 'Avoid new applications for 6–12 months.' : 'No recent hard pulls — good.' }
  ]
  return { score: Math.max(300, Math.min(850, score)), factors }
}

/* ---------------- Investments ---------------- */

export function holdingValue(h: Holding): number { return h.units * h.currentPrice }
export function holdingGain(h: Holding): number { return holdingValue(h) - h.costBasis }
export function portfolioValue(holdings: Holding[]): number { return holdings.reduce((s, h) => s + holdingValue(h), 0) }
export function portfolioCost(holdings: Holding[]): number { return holdings.reduce((s, h) => s + h.costBasis, 0) }

export function allocationByClass(holdings: Holding[]): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const h of holdings) map.set(h.assetClass, (map.get(h.assetClass) || 0) + holdingValue(h))
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

/* ---------------- Net worth & projection ---------------- */

export function netWorth(s: AppState): number {
  const invest = portfolioValue(s.holdings)
  const cash = s.goals.reduce((sum, g) => sum + g.saved, 0)
  const debt = s.creditAccounts.reduce((sum, c) => sum + c.balance, 0)
  return invest + cash - debt
}

/** Compound a monthly-invested amount with monthly contributions. */
export function projectWealth(opts: {
  start: number; monthlyContribution: number; annualReturn: number; years: number
}): { month: number; value: number }[] {
  const r = opts.annualReturn / 12
  const out: { month: number; value: number }[] = []
  let v = opts.start
  const months = Math.round(opts.years * 12)
  for (let m = 0; m <= months; m++) {
    if (m > 0) v = v * (1 + r) + opts.monthlyContribution
    out.push({ month: m, value: v })
  }
  return out
}

/** Solve required monthly contribution to hit a target. */
export function requiredMonthly(opts: { start: number; target: number; annualReturn: number; years: number }): number {
  const r = opts.annualReturn / 12
  const n = Math.round(opts.years * 12)
  const fvStart = opts.start * Math.pow(1 + r, n)
  const remaining = opts.target - fvStart
  if (remaining <= 0) return 0
  if (r === 0) return remaining / n
  const factor = (Math.pow(1 + r, n) - 1) / r
  return remaining / factor
}

export const expectedReturn: Record<string, number> = {
  conservative: 0.05,
  balanced: 0.08,
  aggressive: 0.11,
  degen: 0.18
}

/* ---------------- Debt payoff (avalanche) ---------------- */

export function debtAvalanche(accounts: CreditAccount[], extra: number): { months: number; interestPaid: number; order: string[] } {
  let debts = accounts.filter(a => a.balance > 0).map(a => ({ ...a }))
  if (!debts.length) return { months: 0, interestPaid: 0, order: [] }
  const order = [...debts].sort((a, b) => b.apr - a.apr).map(d => d.name)
  let month = 0, interest = 0
  while (debts.some(d => d.balance > 0) && month < 600) {
    month++
    let pool = extra
    for (const d of debts) {
      if (d.balance <= 0) continue
      const i = d.balance * (d.apr / 100 / 12)
      interest += i
      d.balance += i
    }
    debts.sort((a, b) => b.apr - a.apr)
    for (const d of debts) {
      if (d.balance <= 0) continue
      const pay = Math.min(d.balance, d.minPayment)
      d.balance -= pay
    }
    for (const d of debts) {
      if (pool <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(d.balance, pool)
      d.balance -= pay; pool -= pay
    }
  }
  return { months: month, interestPaid: interest, order }
}

/* ---------------- Cashflow ---------------- */

export function monthlyCashflow(s: AppState) {
  const income = monthlyIncome(s)
  const bills = monthlyBillTotal(s.bills)
  const goalContrib = s.goals.reduce((sum, g) => sum + g.monthlyContribution, 0)
  const free = income - bills - goalContrib
  const savingsRate = income ? (income - bills) / income : 0
  return { income, bills, goalContrib, free, savingsRate }
}

export function fmtDate(iso: string) { return format(parseISO(iso), 'EEE, MMM d') }
export function fmtShort(iso: string) { return format(parseISO(iso), 'MMM d') }
