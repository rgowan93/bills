import { useMemo, useState } from 'react'
import { Plus, Check, Trash2, Bell, BellOff, Repeat, CalendarClock, Zap } from 'lucide-react'
import { useStore } from '../store/store'
import {
  upcomingBills, money, fmtDate, fundingNeeded, monthlyBillTotal, setAsidePerPaycheck, monthlyEquivalent
} from '../lib/finance'
import type { Bill, BillCategory, Recurrence } from '../lib/types'
import { catMeta } from '../lib/meta'
import { Sheet, Field, Seg } from '../components/ui'
import { addDays } from 'date-fns'

const cats = Object.keys(catMeta) as BillCategory[]
const recs: { value: Recurrence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: '2 wks' },
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' }, { value: 'once', label: 'Once' }
]

function blank(): Omit<Bill, 'id' | 'payments' | 'createdAt'> {
  return { name: '', amount: 0, category: 'utilities', dueDay: 1,
    nextDue: addDays(new Date(), 7).toISOString(), recurrence: 'monthly', autopay: false,
    notify: true, notifyDaysBefore: 3 }
}

export default function Bills() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(blank())
  const [horizon, setHorizon] = useState(30)

  const up = useMemo(() => upcomingBills(s.bills, 365), [s.bills])
  const buffer = fundingNeeded(s.bills, horizon)
  const monthlyBills = monthlyBillTotal(s.bills)

  const openAdd = () => { setEditing(null); setForm(blank()); setOpen(true) }
  const openEdit = (b: Bill) => { setEditing(b); setForm({ ...b }); setOpen(true) }

  const save = () => {
    if (!form.name.trim() || form.amount <= 0) return
    if (editing) s.updateBill(editing.id, form)
    else s.addBill(form)
    setOpen(false)
  }

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header">
        <div><div className="sub">Never miss a due date</div><h1>Bills</h1></div>
        <button className="btn icon primary" onClick={openAdd}><Plus size={20} /></button>
      </div>

      {/* Funding calculator */}
      <div className="card hero">
        <div className="card-title"><CalendarClock size={13} style={{ verticalAlign: -2 }} /> Fund your bills account with</div>
        <div className="big" style={{ fontSize: 36 }}>{money(buffer)}</div>
        <div className="tiny muted">to cover everything due in the next {horizon} days</div>
        <div style={{ marginTop: 14 }}>
          <Seg value={String(horizon)} onChange={v => setHorizon(Number(v))}
            options={[{ value: '7', label: '7d' }, { value: '14', label: '14d' }, { value: '30', label: '30d' }, { value: '60', label: '60d' }]} />
        </div>
        <div className="divider" style={{ margin: '14px 0' }} />
        <div className="grid grid-2" style={{ gap: 10 }}>
          <div><div className="tiny muted">Monthly total</div><div className="b" style={{ fontSize: 17 }}>{money(monthlyBills)}</div></div>
          <div><div className="tiny muted">Per weekly check</div><div className="b" style={{ fontSize: 17 }}>{money(setAsidePerPaycheck(monthlyBills, 'weekly'))}</div></div>
        </div>
      </div>

      {/* Bills list */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>All bills · {s.bills.length}</div>
        {up.length === 0 && <div className="tiny muted" style={{ padding: '12px 0' }}>No bills yet. Tap + to add your first.</div>}
        {up.map(u => {
          const b = u.bill; const m = catMeta[b.category]
          const status = u.daysUntil < 0 ? 'bad' : u.daysUntil <= 3 ? 'warn' : 'good'
          return (
            <div key={b.id} className="lrow" onClick={() => openEdit(b)} style={{ cursor: 'pointer' }}>
              <div className="lico" style={{ background: m.color + '22' }}><span style={{ fontSize: 18 }}>{m.emoji}</span></div>
              <div style={{ flex: 1 }}>
                <div className="name">{b.name} {b.autopay && <Zap size={12} className="muted" style={{ verticalAlign: -1 }} />}</div>
                <div className="meta">
                  {u.daysUntil < 0 ? <span style={{ color: 'var(--bad)' }}>Overdue</span> : u.daysUntil === 0 ? 'Due today' : `In ${u.daysUntil}d`}
                  {' · '}{fmtDate(b.nextDue)} · {recs.find(r => r.value === b.recurrence)?.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt">{money(b.amount)}</div>
                <button className="btn sm" style={{ marginTop: 6, padding: '5px 10px', color: status === 'good' ? 'var(--good)' : 'var(--warn)' }}
                  onClick={(e) => { e.stopPropagation(); s.markPaid(b.id) }}>
                  <Check size={13} /> Paid
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Bill' : 'Add Bill'}>
        <div className="stack">
          <Field label="Name">
            <input value={form.name} placeholder="e.g. Rent, Netflix" onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-2">
            <Field label="Amount">
              <input type="number" inputMode="decimal" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Next due date">
              <input type="date" value={form.nextDue.slice(0, 10)} onChange={e => setForm({ ...form, nextDue: new Date(e.target.value).toISOString() })} />
            </Field>
          </div>
          <Field label="Category">
            <div className="scroll-x">
              {cats.map(c => (
                <button key={c} className={`chip ${form.category === c ? 'info' : ''}`} style={{ flexShrink: 0 }}
                  onClick={() => setForm({ ...form, category: c })}>{catMeta[c].emoji} {catMeta[c].label}</button>
              ))}
            </div>
          </Field>
          <Field label="Repeats">
            <Seg value={form.recurrence} onChange={v => setForm({ ...form, recurrence: v })} options={recs.slice(0, 3)} />
            <div style={{ height: 6 }} />
            <Seg value={form.recurrence} onChange={v => setForm({ ...form, recurrence: v })} options={recs.slice(3)} />
          </Field>
          <div className="card" style={{ padding: 14 }}>
            <div className="between">
              <div className="row"><Zap size={16} className="muted" /><span className="small">Autopay enabled</span></div>
              <button className={`chip ${form.autopay ? 'good' : ''}`} onClick={() => setForm({ ...form, autopay: !form.autopay })}>{form.autopay ? 'On' : 'Off'}</button>
            </div>
            <div className="divider" style={{ margin: '12px 0' }} />
            <div className="between">
              <div className="row">{form.notify ? <Bell size={16} className="muted" /> : <BellOff size={16} className="muted" />}<span className="small">Remind me</span></div>
              <button className={`chip ${form.notify ? 'good' : ''}`} onClick={() => setForm({ ...form, notify: !form.notify })}>{form.notify ? 'On' : 'Off'}</button>
            </div>
            {form.notify && (
              <div style={{ marginTop: 12 }}>
                <Seg value={String(form.notifyDaysBefore)} onChange={v => setForm({ ...form, notifyDaysBefore: Number(v) })}
                  options={[{ value: '1', label: '1d before' }, { value: '3', label: '3d' }, { value: '5', label: '5d' }, { value: '7', label: '7d' }]} />
              </div>
            )}
          </div>
          <div className="tiny muted center">Monthly equivalent: {money(monthlyEquivalent(form.amount, form.recurrence))}</div>
          <button className="btn primary full" onClick={save}>{editing ? 'Save changes' : 'Add bill'}</button>
          {editing && <button className="btn danger full" onClick={() => { s.removeBill(editing.id); setOpen(false) }}><Trash2 size={16} /> Delete</button>}
        </div>
      </Sheet>
    </div>
  )
}
