import { Modal } from './ui'
import { formatJP } from '../lib/dates'
import GymRecord from './GymRecord'
import RunRecord from './RunRecord'
import PickleballRecord from './PickleballRecord'
import WeightProtein from './WeightProtein'

export type RecorderKind = 'gym' | 'run' | 'pickleball' | 'weight'

const TITLES: Record<RecorderKind, string> = {
  gym: '🏋️ 筋トレ',
  run: '🏃 ラン',
  pickleball: '🎾 ピックルボール',
  weight: '⚖️ 体重・タンパク質',
}

export default function Recorder({ kind, date, onClose }: { kind: RecorderKind; date: string; onClose: () => void }) {
  return (
    <Modal title={`${TITLES[kind]}　${formatJP(date)}`} onClose={onClose}>
      {kind === 'gym' && <GymRecord date={date} onClose={onClose} />}
      {kind === 'run' && <RunRecord date={date} onClose={onClose} />}
      {kind === 'pickleball' && <PickleballRecord date={date} onClose={onClose} />}
      {kind === 'weight' && <WeightProtein date={date} onClose={onClose} />}
    </Modal>
  )
}
