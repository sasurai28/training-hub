import { useState } from 'react'
import { StoreProvider } from './store'
import { todayISO } from './lib/dates'
import Home from './components/Home'
import RecordTab from './components/RecordTab'
import CalendarView from './components/CalendarView'
import SettingsView from './components/Settings'
import TabBar, { type Tab } from './components/TabBar'
import Recorder, { type RecorderKind } from './components/Recorder'

export interface RecorderTarget {
  kind: RecorderKind
  date: string
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home')
  const [recorder, setRecorder] = useState<RecorderTarget | null>(null)

  const openRecorder = (kind: RecorderKind, date: string = todayISO()) => setRecorder({ kind, date })
  const closeRecorder = () => setRecorder(null)

  return (
    <div className="app">
      {tab === 'home' && <Home openRecorder={openRecorder} goTab={setTab} />}
      {tab === 'record' && <RecordTab openRecorder={openRecorder} />}
      {tab === 'calendar' && <CalendarView openRecorder={openRecorder} />}
      {tab === 'settings' && <SettingsView />}

      <TabBar tab={tab} onChange={setTab} />

      {recorder && (
        <Recorder kind={recorder.kind} date={recorder.date} onClose={closeRecorder} />
      )}
    </div>
  )
}
