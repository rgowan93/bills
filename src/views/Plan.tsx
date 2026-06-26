import { useMemo, useState } from 'react'
import { Plus, Trash2, Target, TrendingDown, PiggyBank, Flame } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/store'
import {
  monthlyCashflow, money, compactMoney, monthlyBillTotal, debtAvalanche, requiredMonthly, expectedReturn, netWorth
} from '../lib/finance'
import type { Goal } from '../lib/types'
import { Sheet, Field, Seg, Bar, Ring } from '../components/ui'

const goalColors = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee']

export default function Plan() {
  const s = useStore()
  const cf = monthlyCashflow(s)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState<Omit<Goal, 'id'>>({ name: '', target: 1000, saved: 0, monthlyContribution: 100, kind: 'savings', color: goalColors[0] })
  const [contribFor, setContribFor] = useState<Goal | null>(null)
  const [contribAmt, setContribAmt] = useState('')
  const [extra, setExtra] = useState(500)

  const debt = useMemo(() => debtAvalanche(s.creditAccounts, extra), [s.creditAccounts, extra])
  const need = requiredMonthly({ start: Math.max(0, netWorth(s)), target: s.settings.netWorthGoal, annualReturn: expectedReturn[s.settings.riskTolerance], years: s.settings.goalYears })

  const pie = [
    { name: 'Bills', value: cf.bills, color: '#fb6a6a' },
    { name: 'Goals', value: cf.goalContrib, color: '#60a5fa' },
    { name: 'Free', value: Math.max(0, cf.free), color: '#34d399' }
  ].filter(p => p.value > 0)

  const openAdd = () => { setEditing(null); setForm({ name: '', target: 1000, saved: 0, monthlyContribution: 100, kind: 'savings', color: goalColors[s.goals.length % goalColors.length] }); setOpen(true) }
  const save = () => { if (!form.name.trim()) return; editing ? s.updateGoal(editing.id, form) : s.addGoal(form); setOpen(false) }

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header"><div><div className="sub">Budget · goals · debt</div><h1>Plan</h1></div>
        <button className="btn icon primary" onClick={openAdd}><Plus size={20} /></button></div>

      {/* Cashflow */}
      <div className="card">
        <div className="card-title">Monthly cashflow</div>
        <div className="row" style={{ marginTop: 10, gap: 16 }}>
          <div style={{ width: 110, height: 110, position: 'relative' }}>
            <ResponsiveContainer><PieChart>
              <Pie data={pie} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={3} stroke="none">
                {pie.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Pie>
            </PieChart></ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div className="center"><div className="tiny faint">income</div><div className="b small">{compactMoney(cf.income)}</div></div>
            </div>
          </div>
          <div style={{ flex: 1 }} className="stack">
            {[['Income', cf.income, '#fff'], ['Bills', -cf.bills, '#fb6a6a'], ['Goal savings', -cf.goalContrib, '#60a5fa'], ['Free to invest', cf.free, '#34d399']].map(([l, v, c]) => (
              <div className="between" key={l as string}>
                <span className="small muted">{l as string}</span>
                <span className="b mono" style={{ color: c as string }}>{(v as number) < 0 ? '−' : ''}{money(Math.abs(v as number))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="divider" style={{ margin: '12px 0' }} />
        <div className="between"><span className="small muted">Savings rate</span>
          <span className="chip good">{(cf.savingsRate * 100).toFixed(0)}%</span></div>
      </div>

      {/* Millionaire path */}
      <div className="card hero">
        <div className="card-title"><Target size={13} style={{ verticalAlign: -2 }} /> Path to {compactMoney(s.settings.netWorthGoal)}</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span className="big" style={{ fontSize: 32 }}>{money(need)}</span><span className="muted small">/mo needed</span>
        </div>
        <div className="tiny muted">over {s.settings.goalYears} yrs at {(expectedReturn[s.settings.riskTolerance] * 100).toFixed(0)}% assumed return</div>
        <div style={{ marginTop: 12 }}>
          <Bar value={cf.free / Math.max(need, 1)} color={cf.free >= need ? 'var(--good)' : 'var(--accent)'} />
          <div className="between" style={{ marginTop: 6 }}>
            <span className="tiny muted">Your free cashflow: {money(cf.free)}</span>
            <span className="tiny" style={{ color: cf.free >= need ? 'var(--good)' : 'var(--warn)' }}>{cf.free >= need ? 'On track ✓' : `${money(need - cf.free)} short`}</span>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}><PiggyBank size={13} style={{ verticalAlign: -2 }} /> Savings goals</div>
        {s.goals.length === 0 && <div className="tiny muted">No goals yet. Tap + to set one.</div>}
        <div className="stack" style={{ gap: 14 }}>
          {s.goals.map(g => {
            const p = g.target ? g.saved / g.target : 0
            return (
              <div key={g.id} onClick={() => { setEditing(g); setForm({ ...g }); setOpen(true) }} style={{ cursor: 'pointer' }}>
                <div className="between" style={{ marginBottom: 7 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 10, background: g.color }} />
                    <span className="b" style={{ fontSize: 15 }}>{g.name}</span>
                  </div>
                  <span className="small"><span className="b">{money(g.saved)}</span> <span className="faint">/ {money(g.target)}</span></span>
                </div>
                <Bar value={p} color={g.color} />
                <div className="between" style={{ marginTop: 6 }}>
                  <span className="tiny muted">{(p * 100).toFixed(0)}% · {money(g.monthlyContribution)}/mo</span>
                  <button className="btn sm" style={{ padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); setContribFor(g); setContribAmt('') }}>+ Add</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Debt payoff */}
      {s.creditAccounts.some(a => a.balance > 0) && (
        <div className="card">
          <div className="card-title"><TrendingDown size={13} style={{ verticalAlign: -2 }} /> Debt-free plan (avalanche)</div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div><div className="tiny muted">Debt-free in</div><div className="kpi">{Math.floor(debt.months / 12)}y {debt.months % 12}m</div></div>
            <div><div className="tiny muted">Interest paid</div><div className="kpi" style={{ color: 'var(--bad)' }}>{compactMoney(debt.interestPaid)}</div></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="between"><span className="tiny muted">Extra payment / mo</span><span className="b">{money(extra)}</span></div>
            <input type="range" min={0} max={5000} step={100} value={extra} onChange={e => setExtra(Number(e.target.value))} style={{ marginTop: 8, accentColor: 'var(--accent)' }} />
          </div>
          {debt.order.length > 0 && <div className="tiny muted" style={{ marginTop: 10 }}>Attack order (highest APR first): <span className="b" style={{ color: 'var(--text)' }}>{debt.order.join(' → ')}</span></div>}
        </div>
      )}

      {/* Goal sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Goal' : 'New Goal'}>
        <div className="stack">
          <Field label="Name"><input value={form.name} placeholder="e.g. Emergency Fund" onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-2">
            <Field label="Target"><input type="number" inputMode="decimal" value={form.target || ''} onChange={e => setForm({ ...form, target: Number(e.target.value) })} /></Field>
            <Field label="Already saved"><input type="number" inputMode="decimal" value={form.saved || ''} onChange={e => setForm({ ...form, saved: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Monthly contribution"><input type="number" inputMode="decimal" value={form.monthlyContribution || ''} onChange={e => setForm({ ...form, monthlyContribution: Number(e.target.value) })} /></Field>
          <Field label="Type">
            <Seg value={form.kind} onChange={v => setForm({ ...form, kind: v })}
              options={[{ value: 'emergency', label: 'Emergency' }, { value: 'savings', label: 'Savings' }, { value: 'purchase', label: 'Purchase' }]} />
          </Field>
          <Field label="Color">
            <div className="row wrap" style={{ gap: 8 }}>
              {goalColors.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })}
                style={{ width: 34, height: 34, borderRadius: 10, background: c, border: form.color === c ? '2px solid #fff' : 'none', cursor: 'pointer' }} />)}
            </div>
          </Field>
          <button className="btn primary full" onClick={save}>{editing ? 'Save' : 'Create goal'}</button>
          {editing && <button className="btn danger full" onClick={() => { s.removeGoal(editing.id); setOpen(false) }}><Trash2 size={16} /> Delete</button>}
        </div>
      </Sheet>

      {/* Contribute sheet */}
      <Sheet open={!!contribFor} onClose={() => setContribFor(null)} title={`Add to ${contribFor?.name ?? ''}`}>
        <div className="stack">
          <Field label="Amount"><input autoFocus type="number" inputMode="decimal" value={contribAmt} onChange={e => setContribAmt(e.target.value)} placeholder="0" /></Field>
          <div className="row wrap" style={{ gap: 8 }}>
            {[100, 500, 1000, 2500].map(v => <button key={v} className="chip" onClick={() => setContribAmt(String(v))}>+{money(v)}</button>)}
          </div>
          <button className="btn accent full" onClick={() => { if (contribFor) s.contribute(contribFor.id, Number(contribAmt) || 0); setContribFor(null) }}>Add {money(Number(contribAmt) || 0)}</button>
        </div>
      </Sheet>
    </div>
  )
}
