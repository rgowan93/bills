import { useMemo, useState } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Shield, Info } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { useStore } from '../store/store'
import {
  holdingValue, holdingGain, portfolioValue, portfolioCost, allocationByClass,
  money, compactMoney, pct, projectWealth, expectedReturn, netWorth, monthlyCashflow
} from '../lib/finance'
import { allocationModel, DISCLAIMER } from '../lib/insights'
import { buildBuyPlan, suggestedMonthlyInvest, macroMeta } from '../lib/advisor'
import type { Holding } from '../lib/types'
import { assetMeta } from '../lib/meta'
import { Sheet, Field, Seg, Bar } from '../components/ui'
import { Sparkles, ArrowRight } from 'lucide-react'

const classes = Object.keys(assetMeta)

export default function Invest() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [form, setForm] = useState<Omit<Holding, 'id'>>({ symbol: '', name: '', assetClass: 'etf', units: 0, costBasis: 0, currentPrice: 0 })

  const suggested = Math.round(suggestedMonthlyInvest(s))
  const [investAmt, setInvestAmt] = useState<number>(suggested || 1000)
  const plan = useMemo(() => buildBuyPlan(s, investAmt), [s, investAmt])
  const stepTone: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn)', info: 'var(--info)', bad: 'var(--bad)' }

  const pv = portfolioValue(s.holdings)
  const pc = portfolioCost(s.holdings)
  const gain = pv - pc
  const cf = monthlyCashflow(s)
  const nw = netWorth(s)
  const alloc = allocationByClass(s.holdings)
  const model = allocationModel(s.settings.riskTolerance)

  const proj = useMemo(() => {
    const years = [1, 3, 5, 10, 20]
    return years.map(y => ({
      y, ...Object.fromEntries(['conservative', 'balanced', 'aggressive'].map(risk => {
        const v = projectWealth({ start: Math.max(0, nw), monthlyContribution: Math.max(0, cf.free), annualReturn: expectedReturn[risk], years: y })
        return [risk, Math.round(v[v.length - 1].value)]
      }))
    }))
  }, [nw, cf.free])

  const projLine = useMemo(() => projectWealth({
    start: Math.max(0, nw), monthlyContribution: Math.max(0, cf.free), annualReturn: expectedReturn[s.settings.riskTolerance], years: s.settings.goalYears
  }).filter((_, i) => i % 3 === 0).map(p => ({ m: p.month, v: Math.round(p.value) })), [nw, cf.free, s.settings])

  const openAdd = () => { setEditing(null); setForm({ symbol: '', name: '', assetClass: 'etf', units: 0, costBasis: 0, currentPrice: 0 }); setOpen(true) }
  const save = () => { if (!form.symbol.trim()) return; editing ? s.updateHolding(editing.id, form) : s.addHolding(form); setOpen(false) }

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header"><div><div className="sub">Grow your wealth</div><h1>Invest</h1></div>
        <button className="btn icon primary" onClick={openAdd}><Plus size={20} /></button></div>

      {/* Portfolio value */}
      <div className="card hero">
        <div className="card-title">Portfolio value</div>
        <div className="big" style={{ fontSize: 38 }}>{money(pv)}</div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`chip ${gain >= 0 ? 'good' : 'bad'}`}>
            {gain >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {gain >= 0 ? '+' : ''}{money(gain)} ({pc ? pct(gain / pc) : '0%'})
          </span>
          <span className="chip">cost {compactMoney(pc)}</span>
        </div>
      </div>

      {/* Smart advisor — what to buy now */}
      <div className="card" style={{ borderColor: 'rgba(124,92,255,0.3)', background: 'radial-gradient(120% 140% at 0% 0%, rgba(124,92,255,0.18), transparent 60%), var(--surface)' }}>
        <div className="between">
          <div className="card-title"><Sparkles size={13} style={{ verticalAlign: -2 }} /> What to buy now</div>
          <span className="chip info">{s.settings.riskTolerance}</span>
        </div>
        <div className="tiny muted" style={{ margin: '8px 0 12px' }}>A personalized plan for the money you have, in priority order.</div>

        <div className="field">
          <label>Money you have to put to work</label>
          <input type="number" inputMode="decimal" value={investAmt || ''} onChange={e => setInvestAmt(Number(e.target.value))} />
        </div>
        <div className="scroll-x" style={{ marginTop: 10 }}>
          {suggested > 0 && <button className="chip" style={{ flexShrink: 0 }} onClick={() => setInvestAmt(suggested)}>Monthly free: {money(suggested)}</button>}
          {[500, 1000, 5000, 10000, 25000].map(v => <button key={v} className="chip" style={{ flexShrink: 0 }} onClick={() => setInvestAmt(v)}>{money(v)}</button>)}
        </div>

        <div className="stack" style={{ gap: 10, marginTop: 16 }}>
          {plan.steps.map((st, i) => (
            <div key={st.id} className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.03)' }}>
              <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
                <div className="lico" style={{ width: 34, height: 34, background: stepTone[st.tone] + '22', color: stepTone[st.tone], fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between" style={{ gap: 8 }}>
                    <span className="b" style={{ fontSize: 14.5 }}>{st.title}</span>
                    {st.amount !== undefined && <span className="b mono" style={{ color: stepTone[st.tone], whiteSpace: 'nowrap' }}>{money(st.amount)}</span>}
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>{st.detail}</div>
                  {st.instruments && (
                    <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                      {st.instruments.map(ins => (
                        <div key={ins} className="tiny" style={{ color: 'var(--text)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                          <ArrowRight size={11} style={{ color: stepTone[st.tone], flexShrink: 0 }} /> {ins}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {plan.steps.length === 0 && <div className="tiny muted">Enter an amount above to get your plan.</div>}
        </div>
        <p className="disclaimer" style={{ marginTop: 12 }}>Example funds are well-known, broadly diversified instruments shown for education — not a recommendation to buy any specific security. Do your own research.</p>
      </div>

      {/* Drift / rebalance */}
      {pv > 0 && (
        <div className="card">
          <div className="card-title">Portfolio vs target (rebalance)</div>
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            {plan.drift.map(d => {
              const off = Math.abs(d.delta) >= 0.05
              return (
                <div key={d.macro}>
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="small b row" style={{ gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: macroMeta[d.macro].color }} />{macroMeta[d.macro].label}</span>
                    <span className="tiny mono">{(d.currentPct * 100).toFixed(0)}% <span className="faint">/ {(d.targetPct * 100).toFixed(0)}% target</span></span>
                  </div>
                  <Bar value={d.currentPct} color={macroMeta[d.macro].color} />
                  {off && <div className="tiny" style={{ marginTop: 4, color: d.delta > 0 ? 'var(--warn)' : 'var(--info)' }}>
                    {d.delta > 0 ? `Overweight by ${(d.delta * 100).toFixed(0)}% — consider trimming or letting new money flow elsewhere.` : `Underweight by ${(-d.delta * 100).toFixed(0)}% — direct new contributions here.`}
                  </div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Allocation */}
      {alloc.length > 0 && (
        <div className="card">
          <div className="card-title">Asset allocation</div>
          <div className="row" style={{ marginTop: 10, gap: 14 }}>
            <div style={{ width: 120, height: 120 }}>
              <ResponsiveContainer><PieChart>
                <Pie data={alloc} dataKey="value" innerRadius={38} outerRadius={56} paddingAngle={3} stroke="none">
                  {alloc.map((a, i) => <Cell key={i} fill={assetMeta[a.name]?.color ?? '#888'} />)}
                </Pie>
              </PieChart></ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }} className="stack">
              {alloc.sort((a, b) => b.value - a.value).map(a => (
                <div className="between" key={a.name}>
                  <span className="small row" style={{ gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: assetMeta[a.name]?.color }} />{assetMeta[a.name]?.label}</span>
                  <span className="b small">{pct(a.value / pv)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holdings */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}>Holdings · {s.holdings.length}</div>
        {s.holdings.length === 0 && <div className="tiny muted" style={{ padding: '10px 0' }}>Add your stocks, ETFs & crypto to track gains. Update prices manually anytime.</div>}
        {s.holdings.map(h => {
          const g = holdingGain(h)
          return (
            <div key={h.id} className="lrow" onClick={() => { setEditing(h); setForm({ ...h }); setOpen(true) }} style={{ cursor: 'pointer' }}>
              <div className="lico mono" style={{ background: (assetMeta[h.assetClass]?.color ?? '#888') + '22', fontWeight: 800, fontSize: 12, color: assetMeta[h.assetClass]?.color }}>{h.symbol.slice(0, 4)}</div>
              <div style={{ flex: 1 }}>
                <div className="name">{h.symbol}</div>
                <div className="meta">{h.units} @ {money(h.currentPrice)} · {assetMeta[h.assetClass]?.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt">{money(holdingValue(h))}</div>
                <div className="tiny" style={{ color: g >= 0 ? 'var(--good)' : 'var(--bad)' }}>{g >= 0 ? '+' : ''}{money(g)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Projection */}
      <div className="card">
        <div className="card-title">Wealth projection ({s.settings.goalYears}yr)</div>
        <div style={{ height: 120, margin: '12px -8px 0' }}>
          <ResponsiveContainer>
            <LineChart data={projLine}>
              <XAxis dataKey="m" tick={{ fill: '#636a82', fontSize: 10 }} tickFormatter={m => `${Math.round(m / 12)}y`} />
              <YAxis tick={{ fill: '#636a82', fontSize: 10 }} tickFormatter={v => compactMoney(v)} width={42} />
              <Tooltip contentStyle={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                formatter={(v: any) => [money(v), 'Value']} labelFormatter={m => `Month ${m}`} />
              <Line dataKey="v" stroke="#00e0c6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="divider" style={{ margin: '12px 0' }} />
        <div className="tiny muted" style={{ marginBottom: 8 }}>If you invest {money(cf.free)}/mo (your free cashflow):</div>
        <div className="stack" style={{ gap: 8 }}>
          {proj.filter(p => [5, 10, 20].includes(p.y)).map(p => (
            <div className="between" key={p.y}>
              <span className="small">In {p.y} years</span>
              <span className="b" style={{ color: 'var(--accent-2)' }}>{compactMoney((p as any).aggressive as number)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy model */}
      <div className="card">
        <div className="between"><div className="card-title"><Shield size={13} style={{ verticalAlign: -2 }} /> {model.label} model</div>
          <span className="chip info">{s.settings.riskTolerance}</span></div>
        <div className="tiny muted" style={{ margin: '8px 0 12px' }}>A target framework for your risk profile — change it in Settings.</div>
        <div className="stack" style={{ gap: 12 }}>
          {model.alloc.map(a => (
            <div key={a.name}>
              <div className="between" style={{ marginBottom: 5 }}><span className="small b">{a.name}</span><span className="chip">{a.pct}%</span></div>
              <div className="bar"><span style={{ width: `${a.pct}%` }} /></div>
              <div className="tiny faint" style={{ marginTop: 4 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ background: 'rgba(96,165,250,0.06)', borderColor: 'rgba(96,165,250,0.2)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <Info size={15} className="muted" style={{ flexShrink: 0, marginTop: 1 }} />
          <p className="disclaimer">{DISCLAIMER}</p>
        </div>
      </div>

      {/* Holding sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Holding' : 'Add Holding'}>
        <div className="stack">
          <div className="grid grid-2">
            <Field label="Symbol"><input value={form.symbol} placeholder="BTC, VTI…" onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} /></Field>
            <Field label="Name"><input value={form.name} placeholder="optional" onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          </div>
          <Field label="Asset class">
            <div className="scroll-x">{classes.map(c => <button key={c} className={`chip ${form.assetClass === c ? 'info' : ''}`} style={{ flexShrink: 0 }} onClick={() => setForm({ ...form, assetClass: c as any })}>{assetMeta[c].label}</button>)}</div>
          </Field>
          <div className="grid grid-2">
            <Field label="Units / shares"><input type="number" inputMode="decimal" value={form.units || ''} onChange={e => setForm({ ...form, units: Number(e.target.value) })} /></Field>
            <Field label="Current price"><input type="number" inputMode="decimal" value={form.currentPrice || ''} onChange={e => setForm({ ...form, currentPrice: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Total cost basis"><input type="number" inputMode="decimal" value={form.costBasis || ''} onChange={e => setForm({ ...form, costBasis: Number(e.target.value) })} /></Field>
          <div className="tiny muted center">Current value: {money(form.units * form.currentPrice)}</div>
          <button className="btn primary full" onClick={save}>{editing ? 'Save' : 'Add holding'}</button>
          {editing && <button className="btn danger full" onClick={() => { s.removeHolding(editing.id); setOpen(false) }}><Trash2 size={16} /> Delete</button>}
        </div>
      </Sheet>
    </div>
  )
}
