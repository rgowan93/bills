import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Delete } from 'lucide-react'

export default function LockScreen({ pin, onUnlock }: { pin: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState('')
  const [shake, setShake] = useState(false)

  const press = (d: string) => {
    if (entry.length >= 4) return
    const next = entry + d
    setEntry(next)
    if (next.length === 4) {
      if (next === pin) setTimeout(onUnlock, 120)
      else setTimeout(() => { setShake(true); setEntry(''); setTimeout(() => setShake(false), 400) }, 150)
    }
  }

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
      <div style={{ width: 70, height: 70, borderRadius: 22, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
        <Lock size={32} color="#fff" />
      </div>
      <div className="b" style={{ fontSize: 19 }}>Enter passcode</div>
      <div className="tiny muted" style={{ marginTop: 4 }}>WealthOS is locked</div>

      <motion.div className="row" animate={shake ? { x: [-8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} style={{ gap: 16, margin: '28px 0 34px' }}>
        {[0, 1, 2, 3].map(i => (
          <span key={i} style={{ width: 15, height: 15, borderRadius: 15, border: '1.5px solid var(--border-strong)', background: i < entry.length ? 'var(--accent)' : 'transparent', transition: '.15s' }} />
        ))}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: 16 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => {
          if (k === '') return <span key={i} />
          if (k === 'del') return <button key={i} onClick={() => setEntry(entry.slice(0, -1))} style={keyStyle(true)}><Delete size={22} /></button>
          return <button key={i} onClick={() => press(k)} style={keyStyle(false)}>{k}</button>
        })}
      </div>
    </div>
  )
}

function keyStyle(ghost: boolean): React.CSSProperties {
  return {
    width: 76, height: 76, borderRadius: '50%', fontSize: 28, fontWeight: 600,
    background: ghost ? 'transparent' : 'rgba(255,255,255,0.06)', color: 'var(--text)',
    border: '1px solid var(--border)', cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit'
  }
}
