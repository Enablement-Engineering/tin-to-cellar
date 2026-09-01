import type { CSSProperties } from 'react'
import type { WorkbenchLabel, WriteInMode } from './ui-model'

type LabelArtworkProps = {
  label: WorkbenchLabel
  zoom?: number
  x?: number
  y?: number
  mode: WriteInMode
  guides?: boolean
}

export function LabelArtwork({ label, zoom = 1, x = 0, y = 0, mode, guides = false }: LabelArtworkProps) {
  const imageStyle = {
    left: `${label.imageFrame.left}%`,
    top: `${label.imageFrame.top}%`,
    width: `${label.imageFrame.width}%`,
    height: `${label.imageFrame.height}%`,
    '--crop-x': `${x}%`,
    '--crop-y': `${y}%`,
    '--crop-zoom': zoom,
  } as CSSProperties
  const writeInStyle = {
    left: `${label.writeIn.x * 100}%`,
    top: `${label.writeIn.y * 100}%`,
    width: `${label.writeIn.width * 100}%`,
    height: `${label.writeIn.height * 100}%`,
    color: label.writeIn.textColor,
  }

  return (
    <div className={`label-art shape-${label.shape} ${guides ? 'show-guides' : ''}`}>
      <img
        alt=""
        draggable={false}
        src={label.imageUrl}
        style={imageStyle}
      />
      {guides && <><span className="guide guide-trim" /><span className="guide guide-safe" /></>}
      <div className={`write-in mode-${mode.toLowerCase()}`} style={writeInStyle}>
        {(mode === 'JARRED' || mode === 'CELLARED') && <span>{mode}</span>}
        {mode !== 'BLANK' && <i aria-hidden="true" />}
      </div>
    </div>
  )
}
