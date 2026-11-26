import { useState } from 'react'
import type { MelodyNote } from '../core/melody'
import type { MelodyAnalysis } from '../core/melodyAnalysis'
import { midiToName, prettyAccidentals as P, SHARP_NAMES } from '../core/notes'
import type { Instrument, Position, Tuning } from '../instruments/types'
import { Fretboard, type Mark } from './Fretboard'
import { KeySelect } from './KeySelect'
import { scaleMarks } from './helpers'

const EXAMPLES: { label: string; text: string }[] = [
  { label: 'Riff blues in Mi', text: 'E2/8 G2/8 A2/4 E2/8 G2/8 Bb2/8 A2/4 E2/8 G2/8 A2/4 G2/8 E2/2' },
  { label: 'Riff Drop D', text: 'D2/8 D2/8 F2/8 D2/8 G2/8 D2/8 F2/8 E2/8 D2/2' },
  { label: 'Arpeggio jangly', text: 'G3/8 D4/8 B3/8 D4/8 C4/8 E4/8 G4/8 E4/8 D4/8 A4/8 F#4/8 A4/8 G4/2' },
  { label: 'Melodia vocale', text: 'A3 C4 D4/2 E4/8 D4/8 C4 A3/2 G3 A3/1' },
]

/** Picks, for each note, the fret position closest to the previous one (a simple fingering). */
function fingering(notes: MelodyNote[], instrument: Instrument, tuning: Tuning): (Position | null)[] {
  let prev: Position | null = null
  return notes.map((n) => {
    if (n.midi === null) return null
    const options = instrument.positionsOf(n.midi, tuning)
    if (!options.length) return null
    const ref: Position = prev ?? { string: 0, fret: 3 }
    const best = options.reduce((a, b) =>
      Math.abs(b.fret - ref.fret) + Math.abs(b.string - ref.string) * 0.6 < Math.abs(a.fret - ref.fret) + Math.abs(a.string - ref.string) * 0.6 ? b : a,
    )
    prev = best
    return best
  })
}

interface Props {
  text: string
  notes: MelodyNote[]
  errors: string[]
  analysis: MelodyAnalysis | null
  keyChoice: string
  instrument: Instrument
  tuning: Tuning
  activeNote: number | null
  playing: boolean
  withChords: boolean
  hasChords: boolean
  canUndo: boolean
  onText: (t: string) => void
  onKey: (k: string) => void
  onPlay: () => void
  onUndo: () => void
  onWithChords: (v: boolean) => void
  onPick: (midi: number) => void
}

export function MelodyPanel(p: Props) {
  const [showScale, setShowScale] = useState(true)
  const a = p.analysis
  const names = a?.key.names ?? SHARP_NAMES
  const pos = fingering(p.notes, p.instrument, p.tuning)
  const marks: Mark[] = [
    ...(showScale && a ? scaleMarks(a.key, p.tuning, p.instrument.frets) : []),
    ...pos.flatMap((x, i): Mark[] =>
      x ? [{ ...x, kind: i === p.activeNote ? 'active' : 'melody', label: names[(p.notes[i].midi as number) % 12] }] : [],
    ),
  ]

  const removeLast = () => p.onText(p.text.trim().split(/\s+/).slice(0, -1).join(' '))

  return (
    <div className="panel">
      <div className="editor-row">
        <label className="field grow">
          <span>Riff / melodia</span>
          <textarea
            className="big-input"
            rows={2}
            value={p.text}
            onChange={(e) => p.onText(e.target.value)}
            placeholder="es. E2/8 G2/8 A2/4 oppure 6:0 6:3 6:5"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <KeySelect value={p.keyChoice} candidates={a?.candidates ?? []} onChange={p.onKey} />
      </div>
      <p className="muted small">
        Note con ottava (<code>E2</code>, <code>Bb3</code>), durata dopo la barra (<code>/1</code> semibreve, <code>/2</code> minima, <code>/4</code>{' '}
        semiminima, <code>/8</code> croma, <code>/16</code>, punto per il punto: <code>/4.</code>), <code>r</code> = pausa, oppure {p.instrument.tokenHelp}. Puoi
        anche toccare la tastiera qui sotto.
      </p>
      {p.errors.length > 0 && <p className="error">Non riconosco: {p.errors.join(', ')}</p>}
      <div className="examples">
        <span className="muted">Esempi:</span>
        {EXAMPLES.map((e) => (
          <button key={e.label} className="chip-btn" onClick={() => p.onText(e.text)}>
            {e.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn primary" onClick={p.onPlay} disabled={!p.notes.length}>
          {p.playing ? '■ Stop' : '▶ Suona'}
        </button>
        <button className="btn" onClick={removeLast} disabled={!p.text.trim()}>
          ⌫ Ultima nota
        </button>
        <button className="btn" onClick={p.onUndo} disabled={!p.canUndo}>
          ↶ Annulla
        </button>
        <label className="check" title={p.hasChords ? '' : 'Scrivi prima una progressione'}>
          <input type="checkbox" checked={p.withChords} disabled={!p.hasChords} onChange={(e) => p.onWithChords(e.target.checked)} /> con gli accordi
          della progressione
        </label>
      </div>

      <div className="board-head">
        <strong>{a ? a.key.label : 'Tastiera'}</strong>
        <label className="check">
          <input type="checkbox" checked={showScale} onChange={(e) => setShowScale(e.target.checked)} /> scala
        </label>
      </div>
      <Fretboard
        tuning={p.tuning}
        frets={p.instrument.frets}
        marks={marks}
        names={names}
        onPick={(_s, _f, midi) => p.onPick(midi)}
      />

      {a && (
        <div className="analysis">
          <div className="facts">
            <div>
              <span className="muted">Scale compatibili</span>
              <div>
                {a.scaleFits.map((f) => (
                  <span key={f.scale} className="tag">
                    {P(f.tonic)} {f.label} {f.fit < 1 && <small>({Math.round(f.fit * 100)}%)</small>}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="muted">Estensione</span>
              <div>
                {P(a.range.low)}–{P(a.range.high)} ({a.range.semitones} semitoni)
              </div>
            </div>
            <div>
              <span className="muted">Profilo</span>
              <div className="contour">{a.contour}</div>
            </div>
            {a.motifs[0] && (
              <div>
                <span className="muted">Motivo</span>
                <div>
                  {[a.pitched[a.motifs[0].starts[0]], ...a.motifs[0].intervals]
                    .reduce<number[]>((acc, x, i) => (i === 0 ? [x] : [...acc, acc[i - 1] + x]), [])
                    .map((m) => P(midiToName(m, names)))
                    .join(' ')}{' '}
                  ×{a.motifs[0].starts.length}
                </div>
              </div>
            )}
          </div>
          <ul className="observations">
            {a.observations.map((o) => (
              <li key={o}>{P(o)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
