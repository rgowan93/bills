import type { AppState } from './types'
import {
  monthlyCashflow, monthlyBillTotal, creditUtilization, upcomingBills,
  netWorth, requiredMonthly, expectedReturn, portfolioValue, fundingNeeded,
  monthlyIncome, paymentScore
} from './finance'

export interface Insight {
  id: string
  tone: 'good' | 'warn' | 'bad' | 'info'
  title: string
  body: string
  priority: number
}

/**
 * Rule-based coaching engine. Deterministic, transparent, and conservative —
 * it explains *why*. It never tells you to buy a specific ticker; it tells you
 * how to structure cash, debt, emergency reserves, and risk.
 */
export function buildInsights(s: AppState): Insight[] {
  const out: Insight[] = []
  const cf = monthlyCashflow(s)
  const util = creditUtilization(s.creditAccounts)
  const nw = netWorth(s)
  const emergency = s.goals.find(g => g.kind === 'emergency')
  const monthlyBills = monthlyBillTotal(s.bills)
  const ps = paymentScore(s.bills)

  // 1. Overdue / imminent bills
  const soon = upcomingBills(s.bills, 5).filter(u => u.daysUntil >= 0)
  const overdue = upcomingBills(s.bills, 0).filter(u => u.daysUntil < 0)
  if (overdue.length) {
    out.push({ id: 'overdue', tone: 'bad', priority: 100,
      title: `${overdue.length} bill${overdue.length > 1 ? 's' : ''} overdue`,
      body: `Pay immediately to protect your payment history — it's 35% of your credit score. Mark them paid once cleared.` })
  }
  if (soon.length) {
    out.push({ id: 'soon', tone: 'warn', priority: 80,
      title: `${soon.length} bill${soon.length > 1 ? 's' : ''} due within 5 days`,
      body: `Keep your bills account funded with at least ${Math.ceil(soon.reduce((a, b) => a + b.bill.amount, 0))} to cover them.` })
  }

  // 2. Credit utilization
  if (util.totalLimit > 0) {
    if (util.overall > 0.3) {
      out.push({ id: 'util', tone: 'bad', priority: 90,
        title: `Credit utilization is ${(util.overall * 100).toFixed(0)}%`,
        body: `Above 30% drags your score hard. Pay balances down below 10% *before the statement closing date* (not just the due date) for the fastest score jump.` })
    } else if (util.overall > 0.1) {
      out.push({ id: 'util-mid', tone: 'warn', priority: 60,
        title: `Utilization at ${(util.overall * 100).toFixed(0)}%`,
        body: `Good, but the 800+ club keeps it under 10%. Consider paying mid-cycle.` })
    } else {
      out.push({ id: 'util-good', tone: 'good', priority: 20,
        title: 'Utilization under 10%', body: 'Elite range. Keep it here for max score.' })
    }
  }

  // 3. Payment streak
  if (ps.total > 0) {
    out.push({ id: 'streak', tone: ps.rate >= 0.99 ? 'good' : 'warn', priority: 40,
      title: `On-time rate ${(ps.rate * 100).toFixed(0)}% (${ps.streak} streak)`,
      body: ps.rate >= 0.99 ? 'Perfect record. Autopay the minimum on everything so a busy week never costs you.' : 'Turn on autopay for the minimum to never break the streak again.' })
  }

  // 4. Emergency fund
  const efTarget = monthlyBills * 6
  const efHave = emergency?.saved ?? 0
  if (efHave < efTarget) {
    out.push({ id: 'ef', tone: efHave < monthlyBills * 3 ? 'warn' : 'info', priority: 70,
      title: 'Build your emergency fund first',
      body: `Aim for 6 months of expenses (${Math.round(efTarget).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}). You have ${Math.round(efHave).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. This is your foundation before aggressive investing.` })
  }

  // 5. Savings rate
  if (cf.income > 0) {
    if (cf.savingsRate > 0.5) {
      out.push({ id: 'sr', tone: 'good', priority: 30,
        title: `Saving ${(cf.savingsRate * 100).toFixed(0)}% of income`,
        body: `Exceptional. At this rate wealth compounds fast — automate the surplus so it never gets spent.` })
    } else if (cf.savingsRate < 0.2) {
      out.push({ id: 'sr-low', tone: 'warn', priority: 65,
        title: `Savings rate only ${(cf.savingsRate * 100).toFixed(0)}%`,
        body: `On $5–10k/week you can do far better. Every 10% more you save shaves years off your millionaire timeline.` })
    }
  }

  // 6. Idle cash → opportunity cost
  if (cf.free > 1000) {
    out.push({ id: 'idle', tone: 'info', priority: 50,
      title: `${Math.round(cf.free).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/mo is unallocated`,
      body: `Give every dollar a job. Once your emergency fund is full, dollar-cost-average the surplus into a diversified portfolio on a fixed schedule — automation beats timing the market.` })
  }

  // 7. Millionaire path
  const need = requiredMonthly({ start: Math.max(0, nw), target: s.settings.netWorthGoal, annualReturn: expectedReturn[s.settings.riskTolerance], years: s.settings.goalYears })
  if (s.settings.netWorthGoal > 0) {
    const gap = need - cf.free
    out.push({ id: 'goal', tone: gap <= 0 ? 'good' : 'info', priority: gap <= 0 ? 25 : 55,
      title: gap <= 0
        ? `On track for ${(s.settings.netWorthGoal / 1e6).toFixed(1)}M`
        : `Invest ${Math.round(need).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/mo to reach your goal`,
      body: gap <= 0
        ? `Your free cashflow already covers the required monthly investing at a ${(expectedReturn[s.settings.riskTolerance] * 100).toFixed(0)}% assumed return. Stay consistent.`
        : `That's ${Math.round(gap).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} more than your current free cashflow. Raise income, cut bills, or extend the timeline.` })
  }

  // 8. Diversification check
  const pv = portfolioValue(s.holdings)
  if (pv > 0) {
    const crypto = s.holdings.filter(h => h.assetClass === 'crypto').reduce((a, h) => a + h.units * h.currentPrice, 0)
    const cryptoPct = crypto / pv
    if (cryptoPct > 0.2) {
      out.push({ id: 'crypto', tone: 'warn', priority: 58,
        title: `${(cryptoPct * 100).toFixed(0)}% of your portfolio is crypto`,
        body: `High-volatility assets can swing 50%+. A common guideline is capping speculative bets at 5–10% of your portfolio — only risk what you can stomach losing entirely.` })
    }
  }

  return out.sort((a, b) => b.priority - a.priority)
}

/** Strategy guidance by risk profile — frameworks, not stock picks. */
export function allocationModel(risk: AppState['settings']['riskTolerance']) {
  const models: Record<string, { label: string; alloc: { name: string; pct: number; note: string }[] }> = {
    conservative: { label: 'Capital Preservation', alloc: [
      { name: 'Broad index funds', pct: 40, note: 'Total-market / S&P 500 ETFs' },
      { name: 'Bonds / treasuries', pct: 40, note: 'Stability & income' },
      { name: 'Cash / HYSA', pct: 15, note: 'Dry powder + emergency' },
      { name: 'Speculative', pct: 5, note: 'Crypto / single stocks' }
    ]},
    balanced: { label: 'Balanced Growth', alloc: [
      { name: 'Broad index funds', pct: 60, note: 'Core engine of returns' },
      { name: 'Bonds', pct: 20, note: 'Ballast in downturns' },
      { name: 'Cash / HYSA', pct: 10, note: 'Liquidity' },
      { name: 'Speculative', pct: 10, note: 'Crypto / individual names' }
    ]},
    aggressive: { label: 'Aggressive Growth', alloc: [
      { name: 'Broad index funds', pct: 70, note: 'Heavy equity tilt' },
      { name: 'Growth / sector ETFs', pct: 15, note: 'Higher beta' },
      { name: 'Cash', pct: 5, note: 'Minimal drag' },
      { name: 'Speculative', pct: 10, note: 'Crypto / high-conviction picks' }
    ]},
    degen: { label: 'High Risk / High Reward', alloc: [
      { name: 'Broad index funds', pct: 55, note: 'Always keep a core' },
      { name: 'Growth ETFs', pct: 20, note: 'Tech / innovation' },
      { name: 'Crypto', pct: 20, note: 'BTC/ETH majority, alts minority' },
      { name: 'Cash', pct: 5, note: 'Buy-the-dip reserve' }
    ]}
  }
  return models[risk]
}

export const DISCLAIMER =
  'WealthOS provides educational tools and general frameworks, not personalized financial, tax, or investment advice. Markets carry risk including loss of principal. No app can guarantee returns or a specific net-worth outcome. Consider consulting a licensed fiduciary advisor before major decisions.'
