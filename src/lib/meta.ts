import type { BillCategory } from './types'

export const catMeta: Record<BillCategory, { label: string; color: string; emoji: string }> = {
  housing: { label: 'Housing', color: '#7c5cff', emoji: '🏠' },
  utilities: { label: 'Utilities', color: '#60a5fa', emoji: '💡' },
  transport: { label: 'Transport', color: '#34d399', emoji: '🚗' },
  insurance: { label: 'Insurance', color: '#22d3ee', emoji: '🛡️' },
  debt: { label: 'Debt', color: '#fb6a6a', emoji: '💳' },
  subscription: { label: 'Subscription', color: '#f472b6', emoji: '📺' },
  food: { label: 'Food', color: '#fbbf24', emoji: '🍽️' },
  health: { label: 'Health', color: '#a3e635', emoji: '⚕️' },
  childcare: { label: 'Childcare', color: '#fb923c', emoji: '🧸' },
  other: { label: 'Other', color: '#9aa0b4', emoji: '📦' }
}

export const assetMeta: Record<string, { label: string; color: string }> = {
  stock: { label: 'Stocks', color: '#7c5cff' },
  etf: { label: 'ETFs', color: '#60a5fa' },
  crypto: { label: 'Crypto', color: '#fbbf24' },
  bond: { label: 'Bonds', color: '#34d399' },
  cash: { label: 'Cash', color: '#22d3ee' },
  'real-estate': { label: 'Real Estate', color: '#f472b6' },
  other: { label: 'Other', color: '#9aa0b4' }
}
