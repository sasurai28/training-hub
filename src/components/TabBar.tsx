export type Tab = 'home' | 'record' | 'calendar' | 'stats' | 'settings'

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'home', ico: '🏠', label: '今日' },
  { id: 'record', ico: '✏️', label: '記録' },
  { id: 'calendar', ico: '🗓️', label: 'カレンダー' },
  { id: 'stats', ico: '📈', label: '分析' },
  { id: 'settings', ico: '⚙️', label: '設定' },
]

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => onChange(t.id)}
            aria-current={tab === t.id}
          >
            <span className="ico">{t.ico}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
