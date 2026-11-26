import { useState } from 'react'
import type { ParsedChord } from '../core/chords'
import { prettyAccidentals as P } from '../core/notes'
import type { ProgressionAnalysis } from '../core/progression'
import type { Instrument, Tuning } from '../instruments/types'
import { Fretboard } from './Fretboard'
import { KeySelect } from './KeySelect'
import { offsetLabel, scaleMarks, soundingChord, soundingKey, voicingMarks, voicingsFor } from './helpers'

interface Props {
  text: string
  errors: string[]
  analysis: ProgressionAnalysis | null
  keyChoice: string
  instrument: Instrument
  tuning: Tuning
  activeChord: number | null
  playing: boolean
  canUndo: boolean
  onText: (t: string) => void
  onKey: (k: string) => void
  onPlay: () => void
  loop: boolean
  loopRange: { from: number; to: number }
  onLoop: (v: boolean) => void
  onRange: (r: { from: number; to: number }) => void
  onUndo: () => void
  onPreview: (c: ParsedChord, voicing: number) => void
}

export function ProgressionPanel(p: Props) {
  const [selected, setSelected] = useState(0)
  const [voicingIdx, setVoicingIdx] = useState(0)
  const [showScale, setShowScale] = useState(false)
  const a = p.analysis
  const sel = a ? Math.min(p.activeChord ?? selected, a.chords.length - 1) : 0
  const chord = a?.chords[sel]
  const voicings = chord ? voicingsFor(chord, p.instrument, p.tuning) : []
  const vi = Math.min(voicingIdx, Math.max(0, voicings.length - 1))
  const voicing = voicings[vi]
  const names = a?.key.names ?? []

  const marks = [
    ...(showScale && a ? scaleMarks(a.key, p.tuning, p.instrument.frets) : []),
    ...(voicing && chord ? voicingMarks(voicing, chord, p.tuning, names) : []),
  ]
  const muted = voicing ? voicing.frets.flatMap((f, s) => (f === null ? [s] : [])) : []

  const pick = (i: number) => {
    setSelected(i)
    setVoicingIdx(0)
    if (a) p.onPreview(a.chords[i], 0)
  }
  const cycle = (d: number) => {
    if (!chord || !voicings.length) return
    const next = (vi + d + voicings.length) % voicings.length
    setVoicingIdx(next)
    p.onPreview(chord, next)
  }

  return (
    <div className="panel">
      <div className="editor-row">
        <label className="field grow">
          <span>Accordi</span>
          <input
            className="big-input"
            value={p.text}
            onChange={(e) => p.onText(e.target.value)}
            placeholder="es. Em C G D"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <KeySelect value={p.keyChoice} candidates={a?.candidates ?? []} onChange={p.onKey} />
      </div>
      {p.errors.length > 0 && <p className="error">Non riconosco: {p.errors.join(', ')}</p>}

      {a && (
        <>
          <div className="toolbar">
            <button className="btn primary" onClick={p.onPlay}>
              {p.playing ? '■ Stop' : '▶ Suona'}
            </button>
            <button
              className={`btn ${p.loop ? 'toggled' : ''}`}
              aria-pressed={p.loop}
              onClick={() => p.onLoop(!p.loop)}
              title={p.loop ? 'Ripete finché non premi Stop' : 'Suona una volta sola'}
            >
              🔁 Loop {p.loop ? 'sì' : 'no'}
            </button>
            {a.chords.length > 1 && (
              <span className="loop-range">
                da
                <select value={p.loopRange.from} onChange={(e) => p.onRange({ ...p.loopRange, from: Number(e.target.value) })} aria-label="Primo accordo da suonare">
                  {a.chords.map((c, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {P(c.symbol)}
                    </option>
                  ))}
                </select>
                a
                <select value={p.loopRange.to} onChange={(e) => p.onRange({ ...p.loopRange, to: Number(e.target.value) })} aria-label="Ultimo accordo da suonare">
                  {a.chords.map((c, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {P(c.symbol)}
                    </option>
                  ))}
                </select>
              </span>
            )}
            <button className="btn" onClick={p.onUndo} disabled={!p.canUndo}>
              ↶ Annulla
            </button>
            <span className="key-label">
              {a.key.label}
              {p.tuning.offset !== 0 && (
                <span className="sounding"> · suona in {soundingKey(a.key, p.tuning.offset).label}</span>
              )}
            </span>
          </div>

          <div className="chord-strip">
            {a.items.map((item, i) => (
              <button
                key={i}
                className={`chord-chip cat-${item.category.replace(/\s/g, '-')} ${i === sel ? 'selected' : ''} ${p.activeChord === i ? 'active' : ''} ${i < p.loopRange.from || i > p.loopRange.to ? 'out-of-range' : ''}`}
                onClick={() => pick(i)}
                title={item.note}
              >
                <span className="chord-symbol">{P(item.chord.symbol)}</span>
                <span className="chord-roman">{P(item.roman)}</span>
                <span className="chord-func">{item.func}</span>
                {p.tuning.offset !== 0 && (
                  <span className="chord-sounding">suona {P(soundingChord(item.chord, a.key, p.tuning.offset))}</span>
                )}
              </button>
            ))}
          </div>

          <div className="board-head">
            <div>
              <strong>{chord ? P(chord.symbol) : ''}</strong>
              {chord && p.tuning.offset !== 0 && (
                <span className="muted">
                  {' '}
                  (suona {P(soundingChord(chord, a.key, p.tuning.offset))}, {offsetLabel(p.tuning.offset)} con le stesse posizioni)
                </span>
              )}
              {voicings.length > 0 && (
                <span className="muted">
                  {' '}
                  · voicing {vi + 1}/{voicings.length}
                </span>
              )}
            </div>
            <div className="board-tools">
              <button className="btn small" onClick={() => cycle(-1)} disabled={voicings.length < 2} aria-label="Voicing precedente">
                ◀
              </button>
              <button className="btn small" onClick={() => cycle(1)} disabled={voicings.length < 2} aria-label="Voicing successivo">
                ▶
              </button>
              <label className="check">
                <input type="checkbox" checked={showScale} onChange={(e) => setShowScale(e.target.checked)} /> scala
              </label>
            </div>
          </div>
          <Fretboard tuning={p.tuning} frets={p.instrument.frets} marks={marks} muted={muted} names={names} />

          <div className="analysis">
            <p className="muted small">{a.items[sel]?.note && P(a.items[sel].note)}</p>
            {a.patterns.length > 0 && (
              <div className="patterns">
                {a.patterns.map((m) => (
                  <div key={m.template.name} className="pattern">
                    <strong>{m.template.name}</strong> <span className="muted">{m.template.romans.map(P).join(' – ')}</span>
                    <p>{m.template.description}</p>
                  </div>
                ))}
              </div>
            )}
            <ul className="observations">
              {a.observations.map((o) => (
                <li key={o}>{P(o)}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
