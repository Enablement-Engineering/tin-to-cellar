import type { PrintLabel } from './ui-model'

export function LabelArtwork({ label }: { label: PrintLabel }) {
  return <div className="label-art">
    <img alt="" draggable={false} src={label.imageUrl} style={{ left: `${label.imageFrame.left}%`, top: `${label.imageFrame.top}%`, width: `${label.imageFrame.width}%`, height: `${label.imageFrame.height}%` }} />
  </div>
}
