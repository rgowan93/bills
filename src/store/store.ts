import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState, Bill, Income, Goal, Holding, CreditAccount, CreditSnapshot, Settings, Transaction, NetWorthPoint
} from '../lib/types'
import { uid, advance, normalizeBill, netWorth } from '../lib/finance'
import { addDays, parseISO, startOfDay, isAfter } from 'date-fns'

interface Store extends AppState {
  // bills
  addBill: (b: Omit<Bill, 'id' | 'payments' | 'createdAt'>) => void
  updateBill: (id: string, patch: Partial<Bill>) => void
  removeBill: (id: string) => void
  markPaid: (id: string) => void
  // income
  addIncome: (i: Omit<Income, 'id'>) => void
  removeIncome: (id: string) => void
  // goals
  addGoal: (g: Omit<Goal, 'id'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  contribute: (id: string, amount: number) => void
  removeGoal: (id: string) => void
  // holdings
  addHolding: (h: Omit<Holding, 'id'>) => void
  updateHolding: (id: string, patch: Partial<Holding>) => void
  removeHolding: (id: string) => void
  // credit
  addCreditAccount: (c: Omit<CreditAccount, 'id'>) => void
  updateCreditAccount: (id: string, patch: Partial<CreditAccount>) => void
  removeCreditAccount: (id: string) => void
  addCreditSnapshot: (s: CreditSnapshot) => void
  // transactions
  addTransaction: (t: Omit<Transaction, 'id'>) => void
  removeTransaction: (id: string) => void
  // settings
  updateSettings: (patch: Partial<Settings>) => void
  // data
  snapshotNetWorth: () => void
  normalizeAll: () => void
  exportData: () => string
  importData: (json: string) => boolean
  resetAll: () => void
  loadDemo: () => void
}

const defaultSettings: Settings = {
  name: '',
  currency: 'USD',
  weeklyIncomeLow: 5000,
  weeklyIncomeHigh: 10000,
  netWorthGoal: 1_000_000,
  goalYears: 5,
  riskTolerance: 'aggressive',
  buffferAccountName: 'Bills Account',
  notificationsEnabled: false,
  onboarded: false,
  lockEnabled: false
}

const iso = (d: Date) => startOfDay(d).toISOString()

function demoState(): AppState {
  const today = new Date()
  const d = (n: number) => iso(addDays(today, n))
  return {
    settings: { ...defaultSettings, name: 'You', onboarded: true },
    income: [
      { id: uid(), source: 'Primary Income', amount: 7500, recurrence: 'weekly', nextDate: d(3) }
    ],
    bills: [
      { id: uid(), name: 'Rent', amount: 2400, category: 'housing', dueDay: 1, nextDue: d(5), recurrence: 'monthly', autopay: false, account: 'Bills', payments: {}, notify: true, notifyDaysBefore: 5, createdAt: iso(today) },
      { id: uid(), name: 'Car Payment', amount: 540, category: 'transport', dueDay: 12, nextDue: d(2), recurrence: 'monthly', autopay: true, payments: {}, notify: true, notifyDaysBefore: 3, createdAt: iso(today) },
      { id: uid(), name: 'Auto Insurance', amount: 180, category: 'insurance', dueDay: 18, nextDue: d(9), recurrence: 'monthly', autopay: true, payments: {}, notify: true, notifyDaysBefore: 3, createdAt: iso(today) },
      { id: uid(), name: 'Electric', amount: 140, category: 'utilities', dueDay: 22, nextDue: d(11), recurrence: 'monthly', autopay: false, payments: {}, notify: true, notifyDaysBefore: 3, createdAt: iso(today) },
      { id: uid(), name: 'Internet', amount: 80, category: 'utilities', dueDay: 8, nextDue: d(1), recurrence: 'monthly', autopay: true, payments: {}, notify: true, notifyDaysBefore: 2, createdAt: iso(today) },
      { id: uid(), name: 'Phone', amount: 95, category: 'utilities', dueDay: 15, nextDue: d(7), recurrence: 'monthly', autopay: true, payments: {}, notify: true, notifyDaysBefore: 2, createdAt: iso(today) },
      { id: uid(), name: 'Streaming bundle', amount: 45, category: 'subscription', dueDay: 20, nextDue: d(14), recurrence: 'monthly', autopay: true, payments: {}, notify: false, notifyDaysBefore: 2, createdAt: iso(today) }
    ],
    goals: [
      { id: uid(), name: 'Emergency Fund', target: 25000, saved: 8000, monthlyContribution: 1500, kind: 'emergency', color: '#34d399' },
      { id: uid(), name: 'Investment Capital', target: 100000, saved: 22000, monthlyContribution: 4000, kind: 'savings', color: '#60a5fa' },
      { id: uid(), name: 'Dream Home Down Payment', target: 120000, saved: 15000, targetDate: iso(addDays(today, 365 * 3)), monthlyContribution: 2000, kind: 'purchase', color: '#f472b6' }
    ],
    holdings: [
      { id: uid(), symbol: 'VTI', name: 'Total Market ETF', assetClass: 'etf', units: 60, costBasis: 14000, currentPrice: 268, targetAllocation: 50 },
      { id: uid(), symbol: 'VXUS', name: 'Intl Stocks ETF', assetClass: 'etf', units: 80, costBasis: 4400, currentPrice: 62, targetAllocation: 15 },
      { id: uid(), symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', units: 0.25, costBasis: 9000, currentPrice: 62000, targetAllocation: 10 },
      { id: uid(), symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto', units: 2, costBasis: 5000, currentPrice: 3400, targetAllocation: 5 },
      { id: uid(), symbol: 'BND', name: 'Bond ETF', assetClass: 'bond', units: 50, costBasis: 3700, currentPrice: 73, targetAllocation: 20 }
    ],
    creditAccounts: [
      { id: uid(), name: 'Sapphire Card', type: 'credit-card', balance: 1200, limit: 18000, apr: 22.99, minPayment: 40, openedAt: iso(addDays(today, -365 * 6)) },
      { id: uid(), name: 'Cashback Card', type: 'credit-card', balance: 300, limit: 12000, apr: 19.99, minPayment: 25, openedAt: iso(addDays(today, -365 * 3)) },
      { id: uid(), name: 'Auto Loan', type: 'auto', balance: 18500, limit: 32000, apr: 6.4, minPayment: 540, openedAt: iso(addDays(today, -365 * 2)) }
    ],
    creditHistory: [
      { date: iso(addDays(today, -120)), score: 712 },
      { date: iso(addDays(today, -90)), score: 728 },
      { date: iso(addDays(today, -60)), score: 741 },
      { date: iso(addDays(today, -30)), score: 758 }
    ],
    transactions: [
      { id: uid(), date: d(-1), description: 'Groceries', amount: -184, category: 'food' },
      { id: uid(), date: d(-2), description: 'Gas', amount: -62, category: 'transport' },
      { id: uid(), date: d(-3), description: 'Dinner out', amount: -88, category: 'food' },
      { id: uid(), date: d(-4), description: 'Paycheck', amount: 7500, category: 'income' },
      { id: uid(), date: d(-6), description: 'Amazon', amount: -130, category: 'shopping' }
    ],
    netWorthHistory: [
      { date: d(-150), value: 38000 }, { date: d(-120), value: 44000 },
      { date: d(-90), value: 51000 }, { date: d(-60), value: 58500 },
      { date: d(-30), value: 65000 }, { date: d(0), value: 71990 }
    ]
  }
}

const empty: AppState = {
  bills: [], income: [], goals: [], holdings: [], creditAccounts: [], creditHistory: [], transactions: [],
  netWorthHistory: [], settings: defaultSettings
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...empty,

      addBill: (b) => set(s => ({ bills: [...s.bills, normalizeBill({ ...b, id: uid(), payments: {}, createdAt: new Date().toISOString() })] })),
      updateBill: (id, patch) => set(s => ({ bills: s.bills.map(b => b.id === id ? { ...b, ...patch } : b) })),
      removeBill: (id) => set(s => ({ bills: s.bills.filter(b => b.id !== id) })),
      markPaid: (id) => set(s => ({
        bills: s.bills.map(b => {
          if (b.id !== id) return b
          const due = startOfDay(parseISO(b.nextDue))
          const now = new Date()
          const onTime = !isAfter(startOfDay(now), due)
          const payments = { ...b.payments, [b.nextDue.slice(0, 10)]: { paidOn: now.toISOString(), onTime, amount: b.amount } }
          if (b.recurrence === 'once') return { ...b, payments }
          return { ...b, payments, nextDue: advance(due, b.recurrence).toISOString() }
        })
      })),

      addIncome: (i) => set(s => ({ income: [...s.income, { ...i, id: uid() }] })),
      removeIncome: (id) => set(s => ({ income: s.income.filter(i => i.id !== id) })),

      addGoal: (g) => set(s => ({ goals: [...s.goals, { ...g, id: uid() }] })),
      updateGoal: (id, patch) => set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...patch } : g) })),
      contribute: (id, amount) => set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g) })),
      removeGoal: (id) => set(s => ({ goals: s.goals.filter(g => g.id !== id) })),

      addHolding: (h) => set(s => ({ holdings: [...s.holdings, { ...h, id: uid() }] })),
      updateHolding: (id, patch) => set(s => ({ holdings: s.holdings.map(h => h.id === id ? { ...h, ...patch } : h) })),
      removeHolding: (id) => set(s => ({ holdings: s.holdings.filter(h => h.id !== id) })),

      addCreditAccount: (c) => set(s => ({ creditAccounts: [...s.creditAccounts, { ...c, id: uid() }] })),
      updateCreditAccount: (id, patch) => set(s => ({ creditAccounts: s.creditAccounts.map(c => c.id === id ? { ...c, ...patch } : c) })),
      removeCreditAccount: (id) => set(s => ({ creditAccounts: s.creditAccounts.filter(c => c.id !== id) })),
      addCreditSnapshot: (snap) => set(s => ({ creditHistory: [...s.creditHistory, snap].sort((a, b) => a.date.localeCompare(b.date)) })),

      addTransaction: (t) => set(s => ({ transactions: [{ ...t, id: uid() }, ...s.transactions] })),
      removeTransaction: (id) => set(s => ({ transactions: s.transactions.filter(t => t.id !== id) })),

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

      snapshotNetWorth: () => set(s => {
        const today = new Date().toISOString().slice(0, 10)
        const val = netWorth(s)
        const hist = s.netWorthHistory.filter(p => p.date.slice(0, 10) !== today)
        return { netWorthHistory: [...hist, { date: new Date().toISOString(), value: val }].slice(-365) }
      }),
      normalizeAll: () => set(s => ({ bills: s.bills.map(normalizeBill) })),
      exportData: () => {
        const { bills, income, goals, holdings, creditAccounts, creditHistory, transactions, netWorthHistory, settings } = get()
        return JSON.stringify({ bills, income, goals, holdings, creditAccounts, creditHistory, transactions, netWorthHistory, settings }, null, 2)
      },
      importData: (json) => {
        try {
          const d = JSON.parse(json)
          set({
            bills: d.bills ?? [], income: d.income ?? [], goals: d.goals ?? [],
            holdings: d.holdings ?? [], creditAccounts: d.creditAccounts ?? [],
            creditHistory: d.creditHistory ?? [], transactions: d.transactions ?? [],
            netWorthHistory: d.netWorthHistory ?? [],
            settings: { ...defaultSettings, ...(d.settings ?? {}) }
          })
          return true
        } catch { return false }
      },
      resetAll: () => set({ ...empty }),
      loadDemo: () => set({ ...demoState() })
    }),
    { name: 'wealthos-v1', version: 2 }
  )
)
