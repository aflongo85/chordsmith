import { midiToName } from '../core/notes'
import type { Tuning } from '../instruments/types'

export type MarkKind = 'root' | 'tone' | 'scale' | 'scaleRoot' | 'active' | 'melody'

export interface Mark {
  string: number
  fret: number
  kind: MarkKind
  label?: string
}

interface Props {
  tuning: Tuning
  frets: number
  marks: Mark[]
  /** strings shown as muted (x) at the nut */
  muted?: number[]
  names: readonly string[]
  onPick?: (string: number, fret: number, midi: number) => void
}

const FW = 54 // fret width
const SH = 30 // string spacing
const LEFT = 46
const TOP = 26
const INLAYS = [3, 5, 7, 9, 15]

export function Fretboard({ tuning, frets, marks, muted = [], names, onPick }: Props) {
  const n = tuning.strings.length
  const width = LEFT + FW * frets + 16
  const height = TOP + SH * (n - 1) + 34
  // highest string drawn on top, like tablature
  const y = (s: number) => TOP + (n - 1 - s) * SH
  const x = (f: number) => (f === 0 ? LEFT - 22 : LEFT + FW * (f - 0.5))
  const order: Record<MarkKind, number> = { scale: 0, scaleRoot: 1, melody: 2, tone: 3, root: 4, active: 5 }
  const sorted = [...marks].sort((a, b) => order[a.kind] - order[b.kind])

  return (
    <div className="fretboard-scroll">
      <svg
        className="fretboard"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width * 0.85 }}
        role="img"
        aria-label="Tastiera dello strumento"
      >
        {INLAYS.filter((f) => f <= frets).map((f) => (
          <circle key={f} cx={LEFT + FW * (f - 0.5)} cy={TOP + ((n - 1) * SH) / 2} r={6} className="inlay" />
        ))}
        {frets >= 12 && (
          <>
            <circle cx={LEFT + FW * 11.5} cy={TOP + SH * 0.5 * (n > 4 ? 2 : 1)} r={6} className="inlay" />
            <circle cx={LEFT + FW * 11.5} cy={TOP + (n - 1) * SH - SH * 0.5 * (n > 4 ? 2 : 1)} r={6} className="inlay" />
          </>
        )}
        <line x1={LEFT} x2={LEFT} y1={TOP - 4} y2={TOP + (n - 1) * SH + 4} className="nut" />
        {Array.from({ length: frets }, (_, i) => (
          <line key={i} x1={LEFT + FW * (i + 1)} x2={LEFT + FW * (i + 1)} y1={TOP} y2={TOP + (n - 1) * SH} className="fret" />
        ))}
        {Array.from({ length: frets }, (_, i) => (
          <text key={i} x={LEFT + FW * (i + 0.5)} y={height - 6} className="fret-no">
            {i + 1}
          </text>
        ))}
        {tuning.strings.map((open, s) => (
          <g key={s}>
            <line x1={LEFT} x2={LEFT + FW * frets} y1={y(s)} y2={y(s)} className="string" strokeWidth={s < n / 2 ? 2.4 : 1.3} />
            <text x={8} y={y(s) + 4} className="string-name">
              {muted.includes(s) ? '×' : names[open % 12]}
            </text>
            {onPick &&
              Array.from({ length: frets + 1 }, (_, f) => (
                <rect
                  key={f}
                  x={f === 0 ? LEFT - 40 : LEFT + FW * (f - 1)}
                  y={y(s) - SH / 2}
                  width={f === 0 ? 40 : FW}
                  height={SH}
                  className="hit"
                  onClick={() => onPick(s, f, open + f)}
                >
                  <title>{midiToName(open + f, names)}</title>
                </rect>
              ))}
          </g>
        ))}
        {sorted.map((m, i) => (
          <g key={i} className={`mark mark-${m.kind}`} pointerEvents="none">
            <circle cx={x(m.fret)} cy={y(m.string)} r={m.kind === 'scale' || m.kind === 'scaleRoot' ? 8 : 12} />
            {m.label && (
              <text x={x(m.fret)} y={y(m.string) + 4}>
                {m.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
