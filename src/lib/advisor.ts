import type { AppState, Holding } from './types'
import {
  portfolioValue, monthlyBillTotal, monthlyCashflow, holdingValue
} from './finance'

export type Macro = 'equities' | 'bonds' | 'crypto' | 'cash'

export const macroMeta: Record<Macro, { label: string; color: string; instruments: string[]; why: string }> = {
  equities: {
    label: 'Equities (stocks)', color: '#7c5cff',
    instruments: ['VTI or VOO — US total-market / S&P 500 index', 'VXUS — international stocks'],
    why: 'The long-term growth engine. Broad, low-cost index funds beat most stock-pickers over time.'
  },
  bonds: {
    label: 'Bonds', color: '#34d399',
    instruments: ['BND — total US bond market', 'SGOV / BIL — short-term Treasuries (~5% yield)'],
    why: 'Ballast that cushions crashes and pays steady income.'
  },
  crypto: {
    label: 'Crypto', color: '#fbbf24',
    instruments: ['BTC — Bitcoin (the majority of any crypto sleeve)', 'ETH — Ethereum'],
    why: 'High risk, high reward. Stick to the two majors and size it small — it can drop 50%+.'
  },
  cash: {
    label: 'Cash / HYSA', color: '#22d3ee',
    instruments: ['High-yield savings account (HYSA) at ~4–5% APY', 'Money-market fund'],
    why: 'Safe, liquid dry powder for emergencies and buying dips.'
  }
}

/** Target macro mix per risk profile. */
export const targetMix: Record<AppState['settings']['riskTolerance'], Record<Macro, number>> = {
  conservative: { equities: 0.40, bonds: 0.40, cash: 0.15, crypto: 0.05 },
  balanced:     { equities: 0.60, bonds: 0.20, cash: 0.10, crypto: 0.10 },
  aggressive:   { equities: 0.80, bonds: 0.05, cash: 0.05, crypto: 0.10 },
  degen:        { equities: 0.65, bonds: 0.00, cash: 0.05, crypto: 0.30 }
}

function macroOf(h: Holding): Macro {
  switch (h.assetClass) {
    case 'bond': return 'bonds'
    case 'crypto': return 'crypto'
    case 'cash': return 'cash'
    default: return 'equities' // stock, etf, real-estate, other
  }
}

export function currentMacro(holdings: Holding[]): Record<Macro, number> {
  const m: Record<Macro, number> = { equities: 0, bonds: 0, crypto: 0, cash: 0 }
  for (const h of holdings) m[macroOf(h)] += holdingValue(h)
  return m
}

export interface PlanStep {
  id: string
  kind: 'emergency' | 'debt' | 'invest' | 'note'
  tone: 'good' | 'warn' | 'info' | 'bad'
  title: string
  amount?: number
  detail: string
  instruments?: string[]
  macro?: Macro
}

export interface BuyPlan {
  investable: number
  steps: PlanStep[]
  drift: { macro: Macro; currentPct: number; targetPct: number; delta: number }[]
}

/**
 * Personalized "what to do with this money now" plan.
 * Order of operations follows standard personal-finance priority:
 *   1) emergency fund  2) high-interest debt  3) invest the rest to target.
 * Investing uses *cashflow rebalancing* — new money fills the most underweight
 * buckets first, which is tax-efficient and avoids selling.
 */
export function buildBuyPlan(s: AppState, investableInput: number): BuyPlan {
  const steps: PlanStep[] = []
  let remaining = Math.max(0, investableInput)
  const monthlyBills = monthlyBillTotal(s.bills)
  const pv = portfolioValue(s.holdings)
  const cur = currentMacro(s.holdings)
  const target = targetMix[s.settings.riskTolerance]

  // 1) Emergency fund
  const ef = s.goals.find(g => g.kind === 'emergency')
  const efTarget = ef?.target ?? monthlyBills * 6
  const efHave = ef?.saved ?? 0
  if (efHave < efTarget && remaining > 0) {
    const fund = Math.min(remaining, efTarget - efHave)
    steps.push({
      id: 'ef', kind: 'emergency', tone: 'warn', amount: fund,
      title: 'Fund your emergency safety net first',
      detail: `You're ${money(efTarget - efHave)} short of a ${money(efTarget)} cushion (6 months of bills). Park this in a HYSA before investing — it's the foundation everything else stands on.`,
      instruments: macroMeta.cash.instruments
    })
    remaining -= fund
  }

  // 2) High-interest debt (guaranteed return = APR)
  const debts = s.creditAccounts.filter(a => a.balance > 0 && a.apr >= 8).sort((a, b) => b.apr - a.apr)
  for (const d of debts) {
    if (remaining <= 0) break
    const pay = Math.min(remaining, d.balance)
    steps.push({
      id: 'debt-' + d.id, kind: 'debt', tone: 'bad', amount: pay,
      title: `Crush ${d.name} (${d.apr}% APR)`,
      detail: `Paying this off is a guaranteed, tax-free ${d.apr}% return — better than the market's average. Nothing you can buy beats killing ${d.apr}% debt.`
    })
    remaining -= pay
  }

  // 3) Invest the rest to target via underweight-first allocation
  if (remaining > 0) {
    const totalAfter = pv + remaining
    const macros: Macro[] = ['equities', 'bonds', 'crypto', 'cash']
    const gaps = macros.map(mk => ({ mk, gap: Math.max(0, target[mk] * totalAfter - cur[mk]) }))
    const sumGap = gaps.reduce((a, b) => a + b.gap, 0)
    for (const { mk, gap } of gaps) {
      const alloc = sumGap > 0 ? remaining * (gap / sumGap) : remaining * target[mk]
      if (alloc < Math.max(1, remaining * 0.02)) continue
      steps.push({
        id: 'inv-' + mk, kind: 'invest', tone: 'good', amount: alloc, macro: mk,
        title: `Buy ${macroMeta[mk].label} — ${money(alloc)}`,
        detail: macroMeta[mk].why,
        instruments: macroMeta[mk].instruments
      })
    }
    steps.push({
      id: 'dca', kind: 'note', tone: 'info',
      title: 'Spread it out (dollar-cost average)',
      detail: 'Rather than buying all at once, split each purchase across the next 4 weeks. It smooths out market timing risk and builds a habit that compounds for decades.'
    })
  }

  // Drift analysis
  const drift = (['equities', 'bonds', 'crypto', 'cash'] as Macro[]).map(mk => {
    const currentPct = pv ? cur[mk] / pv : 0
    return { macro: mk, currentPct, targetPct: target[mk], delta: currentPct - target[mk] }
  })

  return { investable: investableInput, steps, drift }
}

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
}

/** Suggested monthly amount to invest = free cashflow (after bills & goals). */
export function suggestedMonthlyInvest(s: AppState): number {
  return Math.max(0, monthlyCashflow(s).free)
}
