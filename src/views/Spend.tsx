import { useMemo, useState } from 'react'
import { Plus, Trash2, TrendingDown, Repeat, ChevronLeft } from 'lucide-react'
import { useStore } from '../store/store'
import { money, monthlyEquivalent } from '../lib/finance'
import type { Transaction } from '../lib/types'
import { Sheet, Field, Seg, Bar } from '../components/ui'
import { startOfMonth, isAfter, parseISO, format } from 'date-fns'

const txCats: Record<string, { label: string; color: string; emoji: string }> = {
  food: { label: 'Food & dining', color: '#fbbf24', emoji: '🍽️' },
  transport: { label: 'Transport', color: '#34d399', emoji: '🚗' },
  shopping: { label: 'Shopping', color: '#f472b6', emoji: '🛍️' },
  bills: { label: 'Bills', color: '#60a5fa', emoji: '🧾' },
  health: { label: 'Health', color: '#a3e635', emoji: '⚕️' },
  entertainment: { label: 'Fun', color: '#a78bfa', emoji: '🎬' },
  home: { label: 'Home', color: '#7c5cff', emoji: '🏠' },
  income: { label: 'Income', color: '#22d3ee', emoji: '💰' },
  other: { label: 'Other', color: '#9aa0b4', emoji: '📦' }
}

export default function Spend({ back }: { back?: () => void }) {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<Transaction, 'id'>>({ date: new Date().toISOString(), description: '', amount: 0, category: 'food' })
  const [isIncome, setIsIncome] = useState(false)

  const monthStart = startOfMonth(new Date())
  const thisMonth = useMemo(() => s.transactions.filter(t => isAfter(parseISO(t.date), monthStart)), [s.transactions])
  const spent = thisMonth.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)
  const earned = thisMonth.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0)

  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of thisMonth) if (t.amount < 0) m.set(t.category, (m.get(t.category) || 0) + Math.abs(t.amount))
    return [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  }, [thisMonth])

  const subs = s.bills.filter(b => b.category === 'subscription')
  const subsMonthly = subs.reduce((a, b) => a + monthlyEquivalent(b.amount, b.recurrence), 0)

  const save = () => {
    if (form.amount === 0) return
    s.addTransaction({ ...form, amount: isIncome ? Math.abs(form.amount) : -Math.abs(form.amount), category: isIncome ? 'income' : form.category })
    setOpen(false); setForm({ date: new Date().toISOString(), description: '', amount: 0, category: 'food' })
  }

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header">
        <div className="row" style={{ gap: 10 }}>
          {back && <button className="btn icon ghost" onClick={back}><ChevronLeft size={20} /></button>}
          <div><div className="sub">Track every dollar</div><h1>Spending</h1></div>
        </div>
        <button className="btn icon primary" onClick={() => { setIsIncome(false); setOpen(true) }}><Plus size={20} /></button>
      </div>

      {/* Month summary */}
      <div className="card hero">
        <div className="card-title">Spent this month</div>
        <div className="big" style={{ fontSize: 38 }}>{money(spent)}</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip good">+{money(earned)} in</span>
          <span className={`chip ${earned - spent >= 0 ? 'good' : 'bad'}`}>net {earned - spent >= 0 ? '+' : '−'}{money(Math.abs(earned - spent))}</span>
        </div>
      </div>

      {/* By category */}
      {byCat.length > 0 && (
        <div className="card">
          <div className="card-title">Where it went</div>
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            {byCat.map(c => {
              const m = txCats[c.k] ?? txCats.other
              return (
                <div key={c.k}>
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="small b">{m.emoji} {m.label}</span>
                    <span className="b mono">{money(c.v)}</span>
                  </div>
                  <Bar value={spent ? c.v / spent : 0} color={m.color} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Subscription audit */}
      {subs.length > 0 && (
        <div className="card">
          <div className="between"><div className="card-title"><Repeat size={13} style={{ verticalAlign: -2 }} /> Subscriptions</div>
            <span className="chip warn">{money(subsMonthly * 12)}/yr</span></div>
          <div className="tiny muted" style={{ margin: '6px 0 4px' }}>{money(subsMonthly)}/mo across {subs.length} — cancel what you don't use and redirect it to investing.</div>
          {subs.map(b => (
            <div key={b.id} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="small">{b.name}</span><span className="b small">{money(b.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent transactions */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>Recent · {s.transactions.length}</div>
        {s.transactions.length === 0 && <div className="tiny muted" style={{ padding: '10px 0' }}>No transactions yet. Tap + to log spending or income.</div>}
        {s.transactions.slice(0, 30).map(t => {
          const m = txCats[t.category] ?? txCats.other
          return (
            <div key={t.id} className="lrow">
              <div className="lico" style={{ background: m.color + '22' }}><span style={{ fontSize: 17 }}>{m.emoji}</span></div>
              <div style={{ flex: 1 }}>
                <div className="name">{t.description || m.label}</div>
                <div className="meta">{format(parseISO(t.date), 'MMM d')} · {m.label}</div>
              </div>
              <div className="amt" style={{ color: t.amount > 0 ? 'var(--good)' : 'var(--text)' }}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</div>
              <button className="btn icon ghost" style={{ width: 32, height: 32, padding: 0 }} onClick={() => s.removeTransaction(t.id)}><Trash2 size={15} className="faint" /></button>
            </div>
          )
        })}
      </div>

      {/* Add sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Log transaction">
        <div className="stack">
          <Seg value={isIncome ? 'income' : 'expense'} onChange={v => setIsIncome(v === 'income')}
            options={[{ value: 'expense', label: '− Expense' }, { value: 'income', label: '+ Income' }]} />
          <div className="grid grid-2">
            <Field label="Amount"><input autoFocus type="number" inputMode="decimal" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field label="Date"><input type="date" value={form.date.slice(0, 10)} onChange={e => setForm({ ...form, date: new Date(e.target.value).toISOString() })} /></Field>
          </div>
          <Field label="Description"><input value={form.description} placeholder="e.g. Groceries" onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          {!isIncome && (
            <Field label="Category">
              <div className="scroll-x">
                {Object.keys(txCats).filter(k => k !== 'income').map(k => (
                  <button key={k} className={`chip ${form.category === k ? 'info' : ''}`} style={{ flexShrink: 0 }} onClick={() => setForm({ ...form, category: k })}>{txCats[k].emoji} {txCats[k].label}</button>
                ))}
              </div>
            </Field>
          )}
          <button className="btn primary full" onClick={save}>Add transaction</button>
        </div>
      </Sheet>
    </div>
  )
}
