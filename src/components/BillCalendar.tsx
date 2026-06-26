import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths,
  format, parseISO, startOfDay, isAfter, isBefore, subWeeks, subMonths, subQuarters, subYears, subDays
} from 'date-fns'
import type { Bill, Recurrence } from '../lib/types'
import { advance, money } from '../lib/finance'

function retreat(date: Date, r: Recurrence): Date {
  switch (r) {
    case 'weekly': return subWeeks(date, 1)
    case 'biweekly': return subWeeks(date, 2)
    case 'monthly': return subMonths(date, 1)
    case 'quarterly': return subQuarters(date, 1)
    case 'yearly': return subYears(date, 1)
    default: return subDays(date, 99999)
  }
}

function occurrences(bill: Bill, mStart: Date, mEnd: Date): Date[] {
  const base = startOfDay(parseISO(bill.nextDue))
  const res: Date[] = []
  const inRange = (d: Date) => !isBefore(d, mStart) && !isAfter(d, mEnd)
  if (bill.recurrence === 'once') return inRange(base) ? [base] : []
  let c = base, g = 0
  while (!isAfter(c, mEnd) && g < 400) { if (inRange(c)) res.push(c); c = advance(c, bill.recurrence); g++ }
  c = base; g = 0
  while (g < 400) { c = retreat(c, bill.recurrence); if (isBefore(c, mStart)) break; if (inRange(c)) res.push(c); g++ }
  return res
}

export default function BillCalendar({ bills, onPick }: { bills: Bill[]; onPick: (b: Bill) => void }) {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const mStart = startOfMonth(month), mEnd = endOfMonth(month)
  const days = eachDayOfInterval({ start: mStart, end: mEnd })
  const pad = getDay(mStart)
  const today = startOfDay(new Date())

  const map = new Map<string, { bill: Bill; date: Date }[]>()
  for (const b of bills) for (const d of occurrences(b, mStart, mEnd)) {
    const k = format(d, 'yyyy-MM-dd')
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push({ bill: b, date: d })
  }

  const [sel, setSel] = useState<string | null>(format(today, 'yyyy-MM-dd'))
  const selItems = sel ? (map.get(sel) ?? []) : []
  const monthTotal = [...map.values()].flat().reduce((a, x) => a + x.bill.amount, 0)

  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 12 }}>
        <button className="btn icon ghost" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={18} /></button>
        <div className="center"><div className="b">{format(month, 'MMMM yyyy')}</div><div className="tiny muted">{money(monthTotal)} in bills</div></div>
        <button className="btn icon ghost" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="tiny faint center" style={{ padding: '2px 0' }}>{d}</div>)}
        {Array.from({ length: pad }).map((_, i) => <div key={'p' + i} />)}
        {days.map(d => {
          const k = format(d, 'yyyy-MM-dd')
          const items = map.get(k)
          const isToday = isSameDay(d, today)
          const isSel = sel === k
          const total = items?.reduce((a, x) => a + x.bill.amount, 0) ?? 0
          return (
            <button key={k} onClick={() => setSel(k)}
              style={{
                aspectRatio: '1', border: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                background: isToday ? 'rgba(124,92,255,0.18)' : items ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderRadius: 11, color: 'var(--text)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3, padding: 0, fontFamily: 'inherit'
              }}>
              <span className="tiny" style={{ fontWeight: isToday ? 800 : 500, fontSize: 12.5 }}>{format(d, 'd')}</span>
              {items && <span className="mono" style={{ fontSize: 8, color: 'var(--accent-2)' }}>{total >= 1000 ? `${(total / 1000).toFixed(1)}k` : `$${total}`}</span>}
            </button>
          )
        })}
      </div>
      {selItems.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="tiny muted" style={{ marginBottom: 4 }}>{sel && format(parseISO(sel), 'EEEE, MMM d')}</div>
          {selItems.map(({ bill }) => (
            <div key={bill.id} className="between" onClick={() => onPick(bill)} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <span className="small b">{bill.name}</span><span className="b">{money(bill.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
