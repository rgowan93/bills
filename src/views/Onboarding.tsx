import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, Target, ShieldCheck, Rocket } from 'lucide-react'
import { useStore } from '../store/store'
import { Field, Seg } from '../components/ui'
import { money } from '../lib/finance'

export default function Onboarding() {
  const s = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [low, setLow] = useState(5000)
  const [high, setHigh] = useState(10000)
  const [goal, setGoal] = useState(1_000_000)
  const [years, setYears] = useState(5)
  const [risk, setRisk] = useState<'conservative' | 'balanced' | 'aggressive' | 'degen'>('aggressive')

  const finish = (demo: boolean) => {
    if (demo) { s.loadDemo(); s.updateSettings({ name: name || 'You' }); return }
    s.updateSettings({ name, weeklyIncomeLow: low, weeklyIncomeHigh: high, netWorthGoal: goal, goalYears: years, riskTolerance: risk, onboarded: true })
  }

  const steps = [
    (
      <div className="center stack" style={{ gap: 18, alignItems: 'center', paddingTop: 30 }}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}
          style={{ width: 96, height: 96, borderRadius: 28, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'grid', placeItems: 'center', boxShadow: '0 20px 50px -12px rgba(124,92,255,0.7)' }}>
          <Rocket size={48} color="#fff" />
        </motion.div>
        <div>
          <h1 style={{ fontSize: 32 }}>WealthOS</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: 320 }}>Your private command center for bills, budget, savings, investing & perfect credit — built to take you to your first million.</p>
        </div>
        <div className="stack" style={{ width: '100%', gap: 10, marginTop: 8 }}>
          {[[Target, 'Track every bill & never miss a due date'], [ShieldCheck, 'Build credit to a perfect 850'], [Sparkles, 'AI coach + wealth projections']].map(([Icon, t], i) => (
            <div key={i} className="card row" style={{ gap: 12, padding: 14 }}>
              <div className="lico" style={{ background: 'var(--surface-2)' }}>{/* @ts-ignore */}<Icon size={18} style={{ color: 'var(--accent-2)' }} /></div>
              <span className="small b">{t as string}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    (
      <div className="stack" style={{ gap: 18, paddingTop: 20 }}>
        <h2 style={{ fontSize: 24 }}>Let's get to know you</h2>
        <Field label="What's your name?"><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></Field>
        <div className="grid grid-2">
          <Field label="Weekly income (low)"><input type="number" inputMode="decimal" value={low} onChange={e => setLow(Number(e.target.value))} /></Field>
          <Field label="Weekly income (high)"><input type="number" inputMode="decimal" value={high} onChange={e => setHigh(Number(e.target.value))} /></Field>
        </div>
        <div className="card center" style={{ padding: 14 }}><div className="tiny muted">Estimated monthly income</div><div className="big-num" style={{ marginTop: 4 }}>{money((low + high) / 2 * 52 / 12)}</div></div>
      </div>
    ),
    (
      <div className="stack" style={{ gap: 18, paddingTop: 20 }}>
        <h2 style={{ fontSize: 24 }}>Your wealth target</h2>
        <Field label="Net worth goal"><input type="number" inputMode="decimal" value={goal} onChange={e => setGoal(Number(e.target.value))} /></Field>
        <Field label="Timeline (years)"><input type="number" inputMode="numeric" value={years} onChange={e => setYears(Number(e.target.value))} /></Field>
        <Field label="How aggressive do you want to invest?">
          <Seg value={risk} onChange={setRisk} options={[{ value: 'conservative', label: 'Safe' }, { value: 'balanced', label: 'Balanced' }, { value: 'aggressive', label: 'Growth' }, { value: 'degen', label: 'High Risk' }]} />
        </Field>
        <p className="tiny faint">You can change all of this anytime in Settings.</p>
      </div>
    )
  ]

  const last = step === steps.length - 1
  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
          {steps[step]}
        </motion.div>
      </AnimatePresence>
      <div style={{ position: 'fixed', bottom: 'calc(24px + var(--safe-bottom))', left: 16, right: 16, maxWidth: 540, margin: '0 auto' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {steps.map((_, i) => <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 7, background: i === step ? 'var(--accent)' : 'var(--border-strong)', transition: '.3s' }} />)}
        </div>
        <button className="btn primary full" onClick={() => last ? finish(false) : setStep(step + 1)}>
          {last ? 'Start building wealth' : 'Continue'} <ArrowRight size={18} />
        </button>
        {step === 0 && <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => finish(true)}>Explore with demo data</button>}
      </div>
    </div>
  )
}
