export type Recurrence = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export type BillCategory =
  | 'housing' | 'utilities' | 'transport' | 'insurance' | 'debt'
  | 'subscription' | 'food' | 'health' | 'childcare' | 'other'

export interface Bill {
  id: string
  name: string
  amount: number
  category: BillCategory
  dueDay: number          // day-of-month anchor (1-31) for monthly; or next due date day
  nextDue: string         // ISO date string of the next occurrence
  recurrence: Recurrence
  autopay: boolean
  account?: string
  notes?: string
  /** map of ISO date -> paid timestamp, tracks payment history for on-time score */
  payments: Record<string, { paidOn: string; onTime: boolean; amount: number }>
  notify: boolean
  notifyDaysBefore: number
  createdAt: string
}

export interface Income {
  id: string
  source: string
  amount: number
  recurrence: Recurrence
  nextDate: string
}

export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  targetDate?: string
  monthlyContribution: number
  kind: 'emergency' | 'savings' | 'purchase' | 'debt-payoff' | 'custom'
  color: string
}

export interface Holding {
  id: string
  symbol: string
  name: string
  assetClass: 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real-estate' | 'other'
  units: number
  costBasis: number      // total cost
  currentPrice: number   // per unit (manually updated)
  targetAllocation?: number // % desired
}

export interface CreditAccount {
  id: string
  name: string
  type: 'credit-card' | 'loan' | 'mortgage' | 'auto'
  balance: number
  limit: number          // for cards; for loans use original principal
  apr: number
  minPayment: number
  openedAt?: string
}

export interface CreditSnapshot {
  date: string
  score: number
}

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number   // negative = expense, positive = income
  category: string
}

export interface Settings {
  name: string
  currency: string
  weeklyIncomeLow: number
  weeklyIncomeHigh: number
  netWorthGoal: number
  goalYears: number
  riskTolerance: 'conservative' | 'balanced' | 'aggressive' | 'degen'
  buffferAccountName: string
  notificationsEnabled: boolean
  onboarded: boolean
  pin?: string
  lockEnabled: boolean
}

export interface NetWorthPoint { date: string; value: number }

export interface AppState {
  bills: Bill[]
  income: Income[]
  goals: Goal[]
  holdings: Holding[]
  creditAccounts: CreditAccount[]
  creditHistory: CreditSnapshot[]
  transactions: Transaction[]
  netWorthHistory: NetWorthPoint[]
  settings: Settings
}
