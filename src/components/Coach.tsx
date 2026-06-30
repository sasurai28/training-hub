import { useRef, useState } from 'react'
import { useStore } from '../store'
import { todayISO } from '../lib/dates'
import { buildCoachContext, streamAdvice } from '../lib/ai'
import type { Tab } from './TabBar'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function Coach({ goTab }: { goTab: (t: Tab) => void }) {
  const { logs, settings, aiKey } = useStore()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    if (!aiKey) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setText('')
    setError('')
    setStatus('loading')
    try {
      const context = buildCoachContext({ logs, settings }, todayISO())
      await streamAdvice(aiKey, context, (delta) => setText((prev) => prev + delta), ctrl.signal)
      setStatus('done')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setStatus('error')
      setError(e instanceof Error ? e.message : '不明なエラー')
    }
  }

  if (!aiKey) {
    return (
      <div className="card">
        <div className="stepper-label">🤖 AIコーチ</div>
        <div className="prev-hint" style={{ marginTop: 4 }}>
          記録をもとにアドバイスを受け取れます。設定でAnthropicのAPIキーを登録すると使えます。
        </div>
        <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => goTab('settings')}>
          設定でAPIキーを登録
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="stepper-label" style={{ margin: 0 }}>🤖 AIコーチ</div>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? '考え中…' : status === 'idle' ? '今週のアドバイス' : 'もう一度'}
        </button>
      </div>
      {text && (
        <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</div>
      )}
      {status === 'loading' && !text && (
        <div className="prev-hint" style={{ marginTop: 10 }}>記録を読み込んでアドバイスを生成しています…</div>
      )}
      {status === 'error' && (
        <div className="prev-hint" style={{ marginTop: 10, color: 'var(--bad, #e5484d)' }}>
          生成に失敗しました: {error}
        </div>
      )}
    </div>
  )
}
