import { upcomingBills } from './finance'
import type { Bill } from './types'

/**
 * On-device notifications. iOS supports the Web Notifications API for PWAs
 * added to the Home Screen (iOS 16.4+). We schedule a daily check that fires a
 * local notification for any bill entering its reminder window. Because iOS
 * suspends background JS, these fire whenever the app is foregrounded plus via
 * the service worker's periodic check where supported — so opening the app each
 * day guarantees you see what's due. True server push would require a backend.
 */

const SHOWN_KEY = 'wealthos.notified'

function getShown(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}') } catch { return {} }
}
function setShown(v: Record<string, string>) { localStorage.setItem(SHOWN_KEY, JSON.stringify(v)) }

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

export async function fireBillReminders(bills: Bill[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const shown = getShown()
  const today = new Date().toISOString().slice(0, 10)
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null

  for (const u of upcomingBills(bills, 14)) {
    const b = u.bill
    if (!b.notify) continue
    if (u.daysUntil < 0 || u.daysUntil > b.notifyDaysBefore) continue
    const key = `${b.id}:${b.nextDue.slice(0, 10)}:${u.daysUntil}`
    if (shown[key] === today) continue
    shown[key] = today

    const whenTxt = u.daysUntil === 0 ? 'due today' : u.daysUntil === 1 ? 'due tomorrow' : `due in ${u.daysUntil} days`
    const title = `💸 ${b.name} ${whenTxt}`
    const body = `${b.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} — set this aside so you're never late.`
    const opts: NotificationOptions = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: b.id, requireInteraction: u.daysUntil <= 1 }
    try {
      if (reg && 'showNotification' in reg) await reg.showNotification(title, opts)
      else new Notification(title, opts)
    } catch { /* ignore */ }
  }
  setShown(shown)
}

let timer: number | undefined
export function startNotificationLoop(getBills: () => Bill[]) {
  fireBillReminders(getBills())
  if (timer) window.clearInterval(timer)
  // re-check every 6h while app is open
  timer = window.setInterval(() => fireBillReminders(getBills()), 6 * 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fireBillReminders(getBills())
  })
}
