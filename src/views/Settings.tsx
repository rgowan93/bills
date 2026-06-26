import { useRef, useState } from 'react'
import { Bell, Download, Upload, Trash2, Sparkles, ChevronLeft, Shield, DollarSign, Lock } from 'lucide-react'
import { useStore } from '../store/store'
import { money } from '../lib/finance'
import { requestPermission } from '../lib/notify'
import { Field, Seg } from '../components/ui'

export default function Settings({ back }: { back: () => void }) {
  const s = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [pinMode, setPinMode] = useState(false)
  const [pinEntry, setPinEntry] = useState('')

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const enableNotifs = async () => {
    const p = await requestPermission()
    s.updateSettings({ notificationsEnabled: p === 'granted' })
    flash(p === 'granted' ? 'Notifications enabled ✓' : 'Permission denied — enable in iOS Settings')
  }

  const doExport = () => {
    const blob = new Blob([s.exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `wealthos-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }
  const doImport = (f: File) => {
    const r = new FileReader()
    r.onload = () => { flash(s.importData(String(r.result)) ? 'Data imported ✓' : 'Invalid file') }
    r.readAsText(f)
  }

  return (
    <div className="view stack" style={{ gap: 14 }}>
      <div className="header">
        <div className="row" style={{ gap: 10 }}>
          <button className="btn icon ghost" onClick={back}><ChevronLeft size={20} /></button>
          <div><div className="sub">Personalize</div><h1>Settings</h1></div>
        </div>
      </div>

      {msg && <div className="card glow-good center small b">{msg}</div>}

      {/* Profile */}
      <div className="card stack">
        <div className="card-title">Profile</div>
        <Field label="Your name"><input value={s.settings.name} onChange={e => s.updateSettings({ name: e.target.value })} placeholder="Name" /></Field>
        <div className="grid grid-2">
          <Field label="Weekly income (low)"><input type="number" inputMode="decimal" value={s.settings.weeklyIncomeLow} onChange={e => s.updateSettings({ weeklyIncomeLow: Number(e.target.value) })} /></Field>
          <Field label="Weekly income (high)"><input type="number" inputMode="decimal" value={s.settings.weeklyIncomeHigh} onChange={e => s.updateSettings({ weeklyIncomeHigh: Number(e.target.value) })} /></Field>
        </div>
        <div className="tiny muted">Used when you haven't added explicit income sources. Avg ≈ {money((s.settings.weeklyIncomeLow + s.settings.weeklyIncomeHigh) / 2)}/wk</div>
      </div>

      {/* Wealth goal */}
      <div className="card stack">
        <div className="card-title"><DollarSign size={13} style={{ verticalAlign: -2 }} /> Wealth goal</div>
        <div className="grid grid-2">
          <Field label="Net worth goal"><input type="number" inputMode="decimal" value={s.settings.netWorthGoal} onChange={e => s.updateSettings({ netWorthGoal: Number(e.target.value) })} /></Field>
          <Field label="Years to reach it"><input type="number" inputMode="numeric" value={s.settings.goalYears} onChange={e => s.updateSettings({ goalYears: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Risk tolerance">
          <Seg value={s.settings.riskTolerance} onChange={v => s.updateSettings({ riskTolerance: v })}
            options={[{ value: 'conservative', label: 'Safe' }, { value: 'balanced', label: 'Balanced' }, { value: 'aggressive', label: 'Growth' }, { value: 'degen', label: 'High Risk' }]} />
        </Field>
      </div>

      {/* Privacy lock */}
      <div className="card">
        <div className="between">
          <div className="row" style={{ gap: 10 }}><Lock size={18} className="muted" />
            <div><div className="b small">Passcode lock</div><div className="tiny faint">Require a 4-digit code to open</div></div></div>
          <button className={`btn sm ${s.settings.lockEnabled ? 'accent' : 'primary'}`}
            onClick={() => {
              if (s.settings.lockEnabled) { s.updateSettings({ lockEnabled: false, pin: undefined }); flash('Lock removed') }
              else { setPinMode(true) }
            }}>{s.settings.lockEnabled ? 'On ✓' : 'Set up'}</button>
        </div>
        {pinMode && !s.settings.lockEnabled && (
          <div className="stack" style={{ marginTop: 14 }}>
            <Field label="Choose a 4-digit passcode">
              <input type="tel" inputMode="numeric" maxLength={4} value={pinEntry} placeholder="••••"
                onChange={e => setPinEntry(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: 22 }} />
            </Field>
            <button className="btn primary full" disabled={pinEntry.length !== 4}
              onClick={() => { s.updateSettings({ pin: pinEntry, lockEnabled: true }); setPinMode(false); setPinEntry(''); flash('Passcode set ✓') }}>Save passcode</button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="between">
          <div className="row" style={{ gap: 10 }}><Bell size={18} className="muted" />
            <div><div className="b small">Bill reminders</div><div className="tiny faint">Get alerts before bills are due</div></div></div>
          <button className={`btn sm ${s.settings.notificationsEnabled ? 'accent' : 'primary'}`} onClick={enableNotifs}>{s.settings.notificationsEnabled ? 'On ✓' : 'Enable'}</button>
        </div>
        <p className="tiny faint" style={{ marginTop: 12, lineHeight: 1.5 }}>
          On iPhone: add this app to your Home Screen first (Share → Add to Home Screen), open it from there, then enable. iOS delivers reminders while the app is installed; opening it daily guarantees you see what's due.
        </p>
      </div>

      {/* Data */}
      <div className="card stack">
        <div className="card-title"><Shield size={13} style={{ verticalAlign: -2 }} /> Your data</div>
        <p className="tiny faint">Everything lives on this device only — nothing is uploaded. Back it up regularly.</p>
        <div className="grid grid-2">
          <button className="btn" onClick={doExport}><Download size={16} /> Export</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} />
        <button className="btn ghost full" onClick={() => { s.loadDemo(); flash('Demo data loaded') }}><Sparkles size={16} /> Load demo data</button>
        <button className="btn danger full" onClick={() => { if (confirm('Erase all data on this device? This cannot be undone.')) { s.resetAll(); flash('All data cleared') } }}><Trash2 size={16} /> Erase everything</button>
      </div>

      <div className="center tiny faint" style={{ padding: '6px 0 0' }}>WealthOS · v1.0 · your private money command center</div>
    </div>
  )
}
