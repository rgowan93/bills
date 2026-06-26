import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }} onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {title && <div className="between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{title}</h2>
              <button className="btn icon ghost" onClick={onClose}><X size={20} /></button>
            </div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Ring({ value, size = 120, stroke = 11, color = '#7c5cff', track = 'rgba(255,255,255,0.08)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg className="ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke}
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - c * v }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        style={color ? { background: color } : undefined} />
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

export function Seg<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return <div className="empty"><div className="ico">{icon}</div><div className="b">{title}</div>{sub && <div className="tiny" style={{ marginTop: 6 }}>{sub}</div>}</div>
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="kpi" style={{ marginTop: 8, color: tone }}>{value}</div>
      {sub && <div className="tiny muted" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
