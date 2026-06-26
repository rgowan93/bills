import { useMemo, useState } from 'react'
import { Plus, Trash2, CreditCard, TrendingUp, CheckCircle2, Circle } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts'
import { useStore } from '../store/store'
import { estimateCreditScore, creditUtilization, money, pct, paymentScore } from '../lib/finance'
import type { CreditAccount } from '../lib/types'
import { Sheet, Field, Seg, Ring, Bar } from '../components/ui'

const scoreColor = (sc: number) => sc >= 800 ? '#34d399' : sc >= 740 ? '#22d3ee' : sc >= 670 ? '#fbbf24' : sc >= 580 ? '#fb923c' : '#fb6a6a'
const scoreLabel = (sc: number) => sc >= 800 ? 'Exceptional' : sc >= 740 ? 'Very Good' : sc >= 670 ? 'Good' : sc >= 580 ? 'Fair' : 'Poor'

export default function Credit() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CreditAccount | null>(null)
  const [form, setForm] = useState<Omit<CreditAccount, 'id'>>({ name: '', type: 'credit-card', balance: 0, limit: 1000, apr: 22, minPayment: 25 })
  const [snapOpen, setSnapOpen] = useState(false)
  const [snapScore, setSnapScore] = useState('')

  const est = useMemo(() => estimateCreditScore(s), [s])
  const util = creditUtilization(s.creditAccounts)
  const ps = paymentScore(s.bills)
  const history = useMemo(() => {
    const h = [...s.creditHistory].map(x => ({ d: x.date, score: x.score }))
    h.push({ d: new Date().toISOString(), score: est.score })
    return h.map((x, i) => ({ i, score: x.score }))
  }, [s.creditHistory, est.score])

  const goalScore = 850
  const toGoal = goalScore - est.score

  const openAdd = () => { setEditing(null); setForm({ name: '', type: 'credit-card', balance: 0, limit: 1000, apr: 22, minPayment: 25 }); setOpen(true) }
  const save = () => { if (!form.name.trim()) return; editing ? s.updateCreditAccount(editing.id, form) : s.addCreditAccount(form); setOpen(false) }

  const tips = [
    { done: ps.rate >= 0.99 && ps.total > 0, text: 'Pay every bill on time (autopay the minimum)' },
    { done: util.overall <= 0.1 && util.totalLimit > 0, text: 'Keep utilization under 10%' },
    { done: util.overall <= 0.3, text: 'Never exceed 30% on any card' },
    { done: s.creditAccounts.some(a => a.openedAt), text: 'Keep your oldest accounts open' },
    { done: new Set(s.creditAccounts.map(a => a.type)).size >= 2, text: 'Maintain a healthy credit mix' },
    { done: s.creditAccounts.filter(a => a.type === 'credit-card').length >= 2, text: 'Have 2+ revolving accounts' }
  ]

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header"><div><div className="sub">Build perfect credit</div><h1>Credit</h1></div>
        <button className="btn icon primary" onClick={openAdd}><Plus size={20} /></button></div>

      {/* Score gauge */}
      <div className="card hero center" style={{ paddingBottom: 22 }}>
        <Ring value={(est.score - 300) / 550} size={180} stroke={14} color={scoreColor(est.score)}>
          <div className="center">
            <div className="tiny faint">estimated</div>
            <div style={{ fontSize: 52, fontWeight: 850, letterSpacing: '-0.04em', color: scoreColor(est.score), lineHeight: 1 }}>{est.score}</div>
            <div className="small b" style={{ color: scoreColor(est.score) }}>{scoreLabel(est.score)}</div>
          </div>
        </Ring>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}>
          <span className="chip">{toGoal > 0 ? `${toGoal} pts to perfect 850` : 'Perfect 850 🏆'}</span>
          <button className="btn sm ghost" onClick={() => setSnapOpen(true)}>Log real score</button>
        </div>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="card">
          <div className="card-title"><TrendingUp size={13} style={{ verticalAlign: -2 }} /> Score trend</div>
          <div style={{ height: 90, margin: '10px -8px -4px' }}>
            <ResponsiveContainer><LineChart data={history}>
              <YAxis domain={[Math.min(...history.map(h => h.score)) - 20, 850]} hide />
              <Tooltip contentStyle={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [v, 'Score']} labelFormatter={() => ''} />
              <Line dataKey="score" stroke={scoreColor(est.score)} strokeWidth={2.5} dot={{ r: 3, fill: scoreColor(est.score) }} />
            </LineChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Factors */}
      <div className="card">
        <div className="card-title">What's moving your score</div>
        <div className="stack" style={{ gap: 13, marginTop: 12 }}>
          {est.factors.map(f => (
            <div key={f.label}>
              <div className="between" style={{ marginBottom: 5 }}>
                <span className="small b">{f.label}</span>
                <span className="tiny" style={{ color: f.impact >= 0.85 ? 'var(--good)' : f.impact >= 0.6 ? 'var(--warn)' : 'var(--bad)' }}>{(f.impact * 100).toFixed(0)}%</span>
              </div>
              <Bar value={f.impact} color={f.impact >= 0.85 ? 'var(--good)' : f.impact >= 0.6 ? 'var(--warn)' : 'var(--bad)'} />
              <div className="tiny faint" style={{ marginTop: 4 }}>{f.tip}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Utilization */}
      {util.totalLimit > 0 && (
        <div className="card">
          <div className="between"><div className="card-title">Total utilization</div>
            <span className={`chip ${util.overall <= 0.1 ? 'good' : util.overall <= 0.3 ? 'warn' : 'bad'}`}>{pct(util.overall)}</span></div>
          <div style={{ marginTop: 10 }}><Bar value={util.overall} color={util.overall <= 0.1 ? 'var(--good)' : util.overall <= 0.3 ? 'var(--warn)' : 'var(--bad)'} /></div>
          <div className="tiny muted" style={{ marginTop: 6 }}>{money(util.totalBalance)} of {money(util.totalLimit)} used · target under 10%</div>
        </div>
      )}

      {/* Accounts */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}><CreditCard size={13} style={{ verticalAlign: -2 }} /> Accounts · {s.creditAccounts.length}</div>
        {s.creditAccounts.length === 0 && <div className="tiny muted" style={{ padding: '10px 0' }}>Add your cards & loans to estimate your score and utilization.</div>}
        {s.creditAccounts.map(a => {
          const u = a.type === 'credit-card' && a.limit ? a.balance / a.limit : 0
          return (
            <div key={a.id} className="lrow" onClick={() => { setEditing(a); setForm({ ...a }); setOpen(true) }} style={{ cursor: 'pointer' }}>
              <div className="lico" style={{ background: 'rgba(124,92,255,0.16)' }}><CreditCard size={18} style={{ color: 'var(--accent)' }} /></div>
              <div style={{ flex: 1 }}>
                <div className="name">{a.name}</div>
                <div className="meta">{a.type.replace('-', ' ')} · {a.apr}% APR{a.type === 'credit-card' ? ` · ${pct(u)} used` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt">{money(a.balance)}</div>
                {a.type === 'credit-card' && <div className="tiny faint">/ {money(a.limit)}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Checklist */}
      <div className="card">
        <div className="card-title">Perfect-credit checklist</div>
        <div className="stack" style={{ gap: 0, marginTop: 6 }}>
          {tips.map((t, i) => (
            <div key={i} className="lrow" style={{ padding: '11px 0' }}>
              {t.done ? <CheckCircle2 size={20} style={{ color: 'var(--good)' }} /> : <Circle size={20} className="faint" />}
              <span className="small" style={{ color: t.done ? 'var(--muted)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="disclaimer center">Estimated score uses public FICO category weights for guidance only — it is not your official score. Check your real score free via your bank or annualcreditreport.com.</p>

      {/* Account sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Account' : 'Add Account'}>
        <div className="stack">
          <Field label="Name"><input value={form.name} placeholder="e.g. Chase Sapphire" onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Type">
            <Seg value={form.type} onChange={v => setForm({ ...form, type: v })} options={[{ value: 'credit-card', label: 'Card' }, { value: 'loan', label: 'Loan' }, { value: 'auto', label: 'Auto' }, { value: 'mortgage', label: 'Mortgage' }]} />
          </Field>
          <div className="grid grid-2">
            <Field label="Balance"><input type="number" inputMode="decimal" value={form.balance || ''} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} /></Field>
            <Field label={form.type === 'credit-card' ? 'Credit limit' : 'Original amount'}><input type="number" inputMode="decimal" value={form.limit || ''} onChange={e => setForm({ ...form, limit: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-2">
            <Field label="APR %"><input type="number" inputMode="decimal" value={form.apr || ''} onChange={e => setForm({ ...form, apr: Number(e.target.value) })} /></Field>
            <Field label="Min payment"><input type="number" inputMode="decimal" value={form.minPayment || ''} onChange={e => setForm({ ...form, minPayment: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Opened (for credit age)"><input type="date" value={form.openedAt?.slice(0, 10) ?? ''} onChange={e => setForm({ ...form, openedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
          <button className="btn primary full" onClick={save}>{editing ? 'Save' : 'Add account'}</button>
          {editing && <button className="btn danger full" onClick={() => { s.removeCreditAccount(editing.id); setOpen(false) }}><Trash2 size={16} /> Delete</button>}
        </div>
      </Sheet>

      {/* Snapshot sheet */}
      <Sheet open={snapOpen} onClose={() => setSnapOpen(false)} title="Log your real score">
        <div className="stack">
          <Field label="Score from your bank/credit app (300–850)"><input autoFocus type="number" inputMode="numeric" value={snapScore} onChange={e => setSnapScore(e.target.value)} placeholder="e.g. 760" /></Field>
          <button className="btn primary full" onClick={() => { const v = Number(snapScore); if (v >= 300 && v <= 850) s.addCreditSnapshot({ date: new Date().toISOString(), score: v }); setSnapOpen(false) }}>Save to history</button>
        </div>
      </Sheet>
    </div>
  )
}
