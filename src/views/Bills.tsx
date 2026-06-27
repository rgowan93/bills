import { useMemo, useRef, useState } from 'react'
import { Plus, Check, Trash2, Bell, BellOff, Repeat, CalendarClock, Zap, ScanLine, Sparkles, Loader2, Layers } from 'lucide-react'
import { useStore } from '../store/store'
import {
  upcomingBills, money, fmtDate, fundingNeeded, monthlyBillTotal, setAsidePerPaycheck, monthlyEquivalent
} from '../lib/finance'
import type { Bill, BillCategory, Recurrence } from '../lib/types'
import { catMeta } from '../lib/meta'
import { Sheet, Field, Seg } from '../components/ui'
import BillCalendar from '../components/BillCalendar'
import { scanBill, type ParsedBill } from '../lib/billscan'
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
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const fileRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanPct, setScanPct] = useState(0)
  const [scanErr, setScanErr] = useState('')
  const [scanned, setScanned] = useState<ParsedBill | null>(null)
  type MultiRow = { include: boolean; name: string; amount: number; nextDue: string; category: BillCategory }
  const [multi, setMulti] = useState<MultiRow[] | null>(null)

  const up = useMemo(() => upcomingBills(s.bills, 365), [s.bills])
  const buffer = fundingNeeded(s.bills, horizon)
  const monthlyBills = monthlyBillTotal(s.bills)

  const openAdd = () => { setEditing(null); setForm(blank()); setScanned(null); setOpen(true) }
  const openEdit = (b: Bill) => { setEditing(b); setForm({ ...b }); setScanned(null); setOpen(true) }

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setScanErr(''); setScanPct(0); setScanning(true)
    try {
      const results = await scanBill(Array.from(files), p => setScanPct(p))
      if (results.length > 1) {
        setMulti(results.map(r => ({
          include: true, name: r.name || '', amount: r.amount ?? 0,
          nextDue: r.nextDue || blank().nextDue, category: r.category || 'debt'
        })))
      } else {
        const result = results[0]
        const b = blank()
        setEditing(null)
        setForm({
          ...b,
          name: result.name || b.name,
          amount: result.amount ?? b.amount,
          category: result.category || b.category,
          recurrence: result.recurrence || b.recurrence,
          nextDue: result.nextDue || b.nextDue,
          account: result.account,
        })
        setScanned(result); setOpen(true)
      }
    } catch (e: any) {
      setScanErr(e?.message?.includes('etwork') ? 'Could not load the scanner. Connect to the internet once so it can download (then it works offline).' : 'Sorry, couldn\'t read that image. Try a clearer, well-lit photo of the bill.')
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
        <div className="row" style={{ gap: 8 }}>
          <button className="btn icon" onClick={() => fileRef.current?.click()} title="Scan a bill"><ScanLine size={20} /></button>
          <button className="btn icon primary" onClick={openAdd}><Plus size={20} /></button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onPickFiles(e.target.files)} />

      {/* Scan bill CTA */}
      <button className="card tap row" style={{ gap: 13, borderColor: 'rgba(0,224,198,0.28)', background: 'radial-gradient(120% 140% at 100% 0%, rgba(0,224,198,0.16), transparent 60%), var(--surface)' }}
        onClick={() => fileRef.current?.click()}>
        <div className="lico" style={{ background: 'rgba(0,224,198,0.16)' }}><ScanLine size={20} style={{ color: 'var(--accent-2)' }} /></div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="b small">Scan a bill <Sparkles size={12} style={{ color: 'var(--accent-2)', verticalAlign: -1 }} /></div>
          <div className="tiny faint">Snap a photo — it reads the amount, due date & sets it up</div>
        </div>
      </button>

      {scanErr && <div className="card" style={{ borderColor: 'rgba(251,106,106,0.3)', background: 'rgba(251,106,106,0.08)' }}><div className="small" style={{ color: 'var(--bad)' }}>{scanErr}</div></div>}

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

      <Seg value={mode} onChange={setMode} options={[{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }]} />

      {mode === 'calendar' && <BillCalendar bills={s.bills} onPick={openEdit} />}

      {/* Bills list */}
      {mode === 'list' && <div className="card">
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
      </div>}

      {/* Scanning overlay */}
      {scanning && (
        <div className="scrim" style={{ alignItems: 'center', zIndex: 70 }}>
          <div className="card" style={{ width: 280, textAlign: 'center', padding: 26 }}>
            <Loader2 size={34} className="spin" style={{ color: 'var(--accent-2)', margin: '0 auto 14px', display: 'block' }} />
            <div className="b">Reading your bill…</div>
            <div className="tiny muted" style={{ margin: '6px 0 14px' }}>Extracting amount, due date & details — all on your device.</div>
            <div className="bar"><span style={{ width: `${Math.max(6, Math.round(scanPct * 100))}%` }} /></div>
            <div className="tiny faint" style={{ marginTop: 8 }}>{Math.round(scanPct * 100)}%</div>
          </div>
        </div>
      )}

      {/* Add/Edit sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Bill' : scanned ? 'Confirm scanned bill' : 'Add Bill'}>
        <div className="stack">
          {scanned && (
            <div className="card" style={{ padding: 13, borderColor: 'rgba(0,224,198,0.3)', background: 'rgba(0,224,198,0.07)' }}>
              <div className="row" style={{ gap: 8 }}><Sparkles size={15} style={{ color: 'var(--accent-2)' }} />
                <span className="small b">Auto-filled from your bill</span></div>
              <div className="tiny faint" style={{ marginTop: 5 }}>
                Found: {[scanned.found.name && 'name', scanned.found.amount && 'amount', scanned.found.date && 'due date'].filter(Boolean).join(', ') || 'partial info'}
                {scanned.account ? ` · acct ${scanned.account}` : ''}. Review and tap save.
              </div>
            </div>
          )}
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

      {/* Multi-bill review sheet */}
      <Sheet open={!!multi} onClose={() => setMulti(null)} title={`${multi?.length ?? 0} payments found`}>
        {multi && (() => {
          const chosen = multi.filter(m => m.include)
          const total = chosen.reduce((a, m) => a + (m.amount || 0), 0)
          const set = (i: number, patch: Partial<MultiRow>) => setMulti(multi.map((m, j) => j === i ? { ...m, ...patch } : m))
          return (
            <div className="stack">
              <div className="card" style={{ padding: 12, borderColor: 'rgba(0,224,198,0.3)', background: 'rgba(0,224,198,0.07)' }}>
                <div className="row" style={{ gap: 8 }}><Layers size={15} style={{ color: 'var(--accent-2)' }} />
                  <span className="small b">Multiple payments detected</span></div>
                <div className="tiny faint" style={{ marginTop: 5 }}>Pick the ones to add — tap any to edit. Each is added as a one-time scheduled bill.</div>
              </div>
              <div className="between">
                <button className="btn sm ghost" onClick={() => setMulti(multi.map(m => ({ ...m, include: true })))}>Select all</button>
                <button className="btn sm ghost" onClick={() => setMulti(multi.map(m => ({ ...m, include: false })))}>Clear</button>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {multi.map((m, i) => (
                  <div key={i} className="card" style={{ padding: 12, opacity: m.include ? 1 : 0.5, borderColor: m.include ? 'var(--border-strong)' : 'var(--border)' }}>
                    <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <button onClick={() => set(i, { include: !m.include })} aria-label="toggle"
                        style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2, border: '1.5px solid var(--border-strong)', background: m.include ? 'var(--accent-2)' : 'transparent', color: '#04201c', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                        {m.include && <Check size={16} strokeWidth={3} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }} className="stack" >
                        <input value={m.name} onChange={e => set(i, { name: e.target.value })} placeholder="Name" style={{ padding: '9px 11px', fontSize: 15, fontWeight: 600 }} />
                        <div className="grid grid-2">
                          <input type="number" inputMode="decimal" value={m.amount || ''} onChange={e => set(i, { amount: Number(e.target.value) })} placeholder="Amount" style={{ padding: '9px 11px' }} />
                          <input type="date" value={m.nextDue.slice(0, 10)} onChange={e => set(i, { nextDue: new Date(e.target.value).toISOString() })} style={{ padding: '9px 11px' }} />
                        </div>
                        <div className="scroll-x">
                          {cats.map(c => (
                            <button key={c} className={`chip ${m.category === c ? 'info' : ''}`} style={{ flexShrink: 0 }} onClick={() => set(i, { category: c })}>{catMeta[c].emoji} {catMeta[c].label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="between" style={{ padding: '4px 2px' }}>
                <span className="small muted">{chosen.length} selected</span>
                <span className="b">{money(total)}</span>
              </div>
              <button className="btn primary full" disabled={!chosen.length}
                onClick={() => {
                  chosen.forEach(m => {
                    if (!m.name.trim() || m.amount <= 0) return
                    s.addBill({ name: m.name.trim(), amount: m.amount, category: m.category, dueDay: 1, nextDue: m.nextDue, recurrence: 'once', autopay: false, notify: true, notifyDaysBefore: 3 })
                  })
                  setMulti(null)
                }}>
                Add {chosen.length} bill{chosen.length === 1 ? '' : 's'}
              </button>
            </div>
          )
        })()}
      </Sheet>
    </div>
  )
}
