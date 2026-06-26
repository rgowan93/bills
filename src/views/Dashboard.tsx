import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Bell, Sparkles, TrendingUp, Wallet, CalendarClock, ChevronRight, Target, PiggyBank } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../store/store'
import {
  netWorth, monthlyCashflow, money, compactMoney, upcomingBills, fundingNeeded,
  setAsidePerPaycheck, monthlyBillTotal, projectWealth, expectedReturn, fmtShort, paymentScore
} from '../lib/finance'
import { buildInsights } from '../lib/insights'
import { catMeta } from '../lib/meta'
import { Bar } from '../components/ui'

const toneColor: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)' }

export default function Dashboard({ go }: { go: (tab: string) => void }) {
  const s = useStore()
  const nw = netWorth(s)
  const cf = monthlyCashflow(s)
  const up = upcomingBills(s.bills, 30).filter(u => u.daysUntil >= 0)
  const monthlyBills = monthlyBillTotal(s.bills)
  const buffer = fundingNeeded(s.bills, 30)
  const perWeek = setAsidePerPaycheck(monthlyBills, 'weekly')
  const insights = useMemo(() => buildInsights(s), [s])
  const ps = paymentScore(s.bills)
  const nwHist = s.netWorthHistory.map((p, i) => ({ i, v: Math.round(p.value) }))
  const nwDelta = nwHist.length >= 2 ? nwHist[nwHist.length - 1].v - nwHist[0].v : 0

  const proj = useMemo(() => projectWealth({
    start: Math.max(0, nw), monthlyContribution: Math.max(0, cf.free),
    annualReturn: expectedReturn[s.settings.riskTolerance], years: s.settings.goalYears
  }).filter((_, i) => i % 2 === 0), [nw, cf.free, s.settings])

  const finalVal = proj[proj.length - 1]?.value ?? 0
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header">
        <div>
          <div className="sub">{greet}{s.settings.name ? `, ${s.settings.name}` : ''}</div>
          <h1>Command Center</h1>
        </div>
        <button className="avatar" onClick={() => go('settings')}>
          {(s.settings.name || 'W').slice(0, 1).toUpperCase()}
        </button>
      </div>

      {/* Net worth hero */}
      <motion.div className="card hero" layout>
        <div className="between">
          <span className="label">Net Worth</span>
          <span className={`delta ${cf.free >= 0 ? 'up' : 'down'}`}>
            {cf.free >= 0 ? '+' : ''}{compactMoney(cf.free)}/mo <ArrowUpRight size={14} style={{ verticalAlign: -2 }} />
          </span>
        </div>
        <div className="big">{money(nw)}</div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="chip"><Wallet size={13} /> {money(cf.income, s.settings.currency)} in</span>
          <span className="chip">{money(monthlyBills)} bills</span>
          <span className="chip good">{(cf.savingsRate * 100).toFixed(0)}% saved</span>
        </div>
        <div style={{ height: 90, margin: '14px -18px -18px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={proj}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip cursor={false} contentStyle={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                formatter={(v: any) => [compactMoney(v), 'Projected']} labelFormatter={(m: any) => `Month ${m}`} />
              <Area dataKey="value" stroke="#9d7bff" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* What to set aside */}
      <div className="card tap" onClick={() => go('bills')}>
        <div className="between">
          <div>
            <div className="card-title">Keep funded to never miss a bill</div>
            <div className="big-num" style={{ marginTop: 8 }}>{money(buffer)}</div>
            <div className="tiny muted" style={{ marginTop: 2 }}>covers all bills due in the next 30 days</div>
          </div>
          <CalendarClock size={26} className="muted" />
        </div>
        <div className="divider" style={{ margin: '14px 0' }} />
        <div className="between">
          <span className="small muted">Set aside per paycheck (weekly)</span>
          <span className="b">{money(perWeek)}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-2">
        <button className="card tap row" style={{ gap: 12 }} onClick={() => go('plan')}>
          <div className="lico" style={{ background: 'rgba(124,92,255,0.18)' }}><Target size={18} style={{ color: 'var(--accent)' }} /></div>
          <div style={{ textAlign: 'left' }}><div className="b small">Plan</div><div className="tiny faint">goals · debt</div></div>
        </button>
        <button className="card tap row" style={{ gap: 12 }} onClick={() => go('spend')}>
          <div className="lico" style={{ background: 'rgba(0,224,198,0.16)' }}><PiggyBank size={18} style={{ color: 'var(--accent-2)' }} /></div>
          <div style={{ textAlign: 'left' }}><div className="b small">Spending</div><div className="tiny faint">track money</div></div>
        </button>
      </div>

      {/* Net worth trend (real history) */}
      {nwHist.length >= 2 && (
        <div className="card">
          <div className="between"><div className="card-title"><TrendingUp size={13} style={{ verticalAlign: -2 }} /> Net worth trend</div>
            <span className={`delta ${nwDelta >= 0 ? 'up' : 'down'}`}>{nwDelta >= 0 ? '+' : '−'}{compactMoney(Math.abs(nwDelta))}</span></div>
          <div style={{ height: 70, margin: '10px -8px -6px' }}>
            <ResponsiveContainer><AreaChart data={nwHist}>
              <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00e0c6" stopOpacity={0.4} /><stop offset="100%" stopColor="#00e0c6" stopOpacity={0} /></linearGradient></defs>
              <Tooltip cursor={false} contentStyle={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [money(v), 'Net worth']} labelFormatter={() => ''} />
              <Area dataKey="v" stroke="#00e0c6" strokeWidth={2} fill="url(#g2)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Coach insights */}
      {insights.length > 0 && (
        <div className="card">
          <div className="between" style={{ marginBottom: 4 }}>
            <div className="card-title"><Sparkles size={13} style={{ verticalAlign: -2 }} /> AI Money Coach</div>
            <span className="chip">{insights.length}</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {insights.slice(0, 4).map(i => (
              <div key={i.id} className="lrow">
                <div className="lico" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: toneColor[i.tone] }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="name" style={{ fontSize: 14 }}>{i.title}</div>
                  <div className="meta">{i.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick grid */}
      <div className="grid grid-2">
        <div className="card tap" onClick={() => go('credit')}>
          <div className="card-title">Payment record</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span className="kpi">{(ps.rate * 100).toFixed(0)}%</span>
            <span className="badge-grade" style={{ fontSize: 16 }}>{ps.grade}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>{ps.streak} on-time streak</div>
        </div>
        <div className="card tap" onClick={() => go('invest')}>
          <div className="card-title">5yr projection</div>
          <div className="kpi" style={{ marginTop: 8, color: 'var(--accent-2)' }}>{compactMoney(finalVal)}</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>at {(expectedReturn[s.settings.riskTolerance] * 100).toFixed(0)}% assumed</div>
        </div>
      </div>

      {/* Upcoming bills preview */}
      <div className="card">
        <div className="between" style={{ marginBottom: 6 }}>
          <div className="card-title">Up next</div>
          <button className="btn sm ghost" onClick={() => go('bills')}>All <ChevronRight size={14} /></button>
        </div>
        {up.length === 0 && <div className="tiny muted">No bills in the next 30 days. 🎉</div>}
        {up.slice(0, 4).map(u => (
          <div key={u.bill.id} className="lrow">
            <div className="lico" style={{ background: catMeta[u.bill.category].color + '22' }}>
              <span style={{ fontSize: 18 }}>{catMeta[u.bill.category].emoji}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div className="name">{u.bill.name}</div>
              <div className="meta">{u.daysUntil === 0 ? 'Due today' : u.daysUntil === 1 ? 'Due tomorrow' : `In ${u.daysUntil} days`} · {fmtShort(u.bill.nextDue)}</div>
            </div>
            <div className="amt">{money(u.bill.amount)}</div>
          </div>
        ))}
      </div>

      <div className="tiny faint center" style={{ padding: '4px 10px 0' }}>
        All data is stored privately on this device.
      </div>
    </div>
  )
}
