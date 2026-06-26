import { useEffect, useState } from 'react'
import { Home, Receipt, Target, LineChart, CreditCard } from 'lucide-react'
import { useStore } from './store/store'
import { startNotificationLoop } from './lib/notify'
import Dashboard from './views/Dashboard'
import Bills from './views/Bills'
import Plan from './views/Plan'
import Invest from './views/Invest'
import Credit from './views/Credit'
import Settings from './views/Settings'
import Onboarding from './views/Onboarding'

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'bills', label: 'Bills', icon: Receipt },
  { id: 'plan', label: 'Plan', icon: Target },
  { id: 'invest', label: 'Invest', icon: LineChart },
  { id: 'credit', label: 'Credit', icon: CreditCard }
]

export default function App() {
  const onboarded = useStore(s => s.settings.onboarded)
  const normalizeAll = useStore(s => s.normalizeAll)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    normalizeAll()
    startNotificationLoop(() => useStore.getState().bills)
  }, [])

  if (!onboarded) {
    return (
      <>
        <Backdrop />
        <Onboarding />
      </>
    )
  }

  return (
    <>
      <Backdrop />
      <div className="app">
        {tab === 'home' && <Dashboard go={setTab} />}
        {tab === 'bills' && <Bills />}
        {tab === 'plan' && <Plan />}
        {tab === 'invest' && <Invest />}
        {tab === 'credit' && <Credit />}
        {tab === 'settings' && <Settings back={() => setTab('home')} />}
      </div>

      {tab !== 'settings' && (
        <nav className="nav">
          <div className="nav-inner">
            {tabs.map(t => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button key={t.id} className={`nav-btn ${active ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                  {active && <span className="nav-ind" />}
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}

function Backdrop() {
  return (
    <>
      <div className="aurora"><div className="blob3" /></div>
      <div className="grain" />
    </>
  )
}
