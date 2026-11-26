import { useMemo, useState } from 'react'
import type { ParsedChord } from '../core/chords'
import { exploreKey, MODE_COLOR, type ExploreChord } from '../core/explore'
import { makeKey, type KeyContext } from '../core/key'
import { prettyAccidentals as P, toSolfege } from '../core/notes'
import { MODE_IDS, SCALES, type ModeId } from '../core/scales'
import type { GenreProfile } from '../genres/types'
import type { Instrument, Tuning } from '../instruments/types'
import { Fretboard } from './Fretboard'
import { keyValue, offsetLabel, soundingChord, soundingKey, voicingMarks, voicingsFor } from './helpers'

interface Props {
  exploreKey: KeyContext
  progressionKey: KeyContext | null
  genre: GenreProfile
  instrument: Instrument
  tuning: Tuning
  progression: ParsedChord[]
  playingId: string | null
  canUndo: boolean
  onKey: (value: string) => void
  onPreview: (c: ParsedChord) => void
  onAdd: (symbol: string) => void
  onListen: (id: string, symbols: string[]) => void
  onUse: (symbols: string[]) => void
  onPlayProgression: () => void
  onUndo: () => void
  onClear: () => void
  onOpen: () => void
}

const MODES = MODE_IDS.filter((m) => m !== 'locrian')

export function ExplorePanel(p: Props) {
  const key = p.exploreKey
  const x = useMemo(() => exploreKey(key, p.genre), [key, p.genre])
  const [selected, setSelected] = useState<ExploreChord | null>(null)
  const sel = selected && [...x.diatonic, ...x.borrowed.flatMap((g) => g.chords), ...x.secondary].find((c) => c.symbol === selected.symbol)
  const voicing = sel ? voicingsFor(sel.chord, p.instrument, p.tuning)[0] : undefined
  const offset = p.tuning.offset

  const pick = (c: ExploreChord) => {
    setSelected(c)
    p.onPreview(c.chord)
  }
  const sameAsProgression = p.progressionKey && keyValue(p.progressionKey) === keyValue(key)

  const card = (c: ExploreChord) => (
    <div key={c.symbol} className={`x-chord cat-${c.category.replace(/\s/g, '-')} ${sel?.symbol === c.symbol ? 'selected' : ''}`}>
      <button className="x-main" onClick={() => pick(c)} title="Ascolta e mostra sul manico">
        <span className="chord-symbol">
          {P(c.symbol)}
          {c.common && (
            <span className="x-star" title={`Tipico del ${p.genre.name.toLowerCase()}`}>
              ★
            </span>
          )}
        </span>
        <span className="chord-roman">{P(c.roman)}</span>
        {c.hint && <span className="chord-func">{c.hint}</span>}
      </button>
      <button className="x-add" onClick={() => p.onAdd(c.symbol)} aria-label={`Aggiungi ${c.symbol} alla progressione`}>
        +
      </button>
    </div>
  )

  const common = x.progressions.filter((pr) => pr.borrowed <= 2)
  const far = x.progressions.filter((pr) => pr.borrowed > 2)
  const progCard = (pr: (typeof x.progressions)[number]) => {
    const id = `x-${pr.template.name}`
    const symbols = pr.chords.map((c) => c.symbol)
    return (
      <div key={pr.template.name} className="x-prog">
        <div className="sugg-head">
          <strong>{pr.template.name}</strong>
          <span className="muted small">
            {pr.template.section !== 'qualsiasi' && `${pr.template.section} · `}
            {pr.borrowed === 0 ? 'tutto in tonalità' : pr.borrowed === 1 ? '1 accordo fuori tonalità' : `${pr.borrowed} accordi fuori tonalità`}
          </span>
        </div>
        <div className="x-prog-chords">
          {pr.chords.map((c, i) => (
            <span key={i} className={`x-pill cat-${c.category.replace(/\s/g, '-')}`}>
              {P(c.symbol)} <small>{P(c.roman)}</small>
            </span>
          ))}
        </div>
        <p className="small">{pr.template.description}</p>
        <div className="sugg-actions">
          <button className="btn small" onClick={() => p.onListen(id, symbols)}>
            {p.playingId === id ? '■ Stop' : '▶ Ascolta'}
          </button>
          <button className="btn small primary" onClick={() => p.onUse(symbols)}>
            Usa come progressione
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="editor-row">
        <label className="field">
          <span>Tonica</span>
          <select value={key.tonicPc} onChange={(e) => p.onKey(`${e.target.value}:${key.mode}`)}>
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>
                {toSolfege(makeKey(pc, key.mode).tonic)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Modo</span>
          <select value={key.mode} onChange={(e) => p.onKey(`${key.tonicPc}:${e.target.value as ModeId}`)}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {SCALES[m].label}
              </option>
            ))}
          </select>
        </label>
        {p.progressionKey && !sameAsProgression && (
          <button className="btn align-end" onClick={() => p.onKey(keyValue(p.progressionKey!))}>
            Usa la tonalità della progressione ({p.progressionKey.label})
          </button>
        )}
      </div>
      <p className="muted small">
        <strong>{key.label}</strong> · {MODE_COLOR[key.mode]}
        {offset !== 0 && ` · con questa accordatura suona in ${soundingKey(key, offset).label}`}. Tocca un accordo per sentirlo e vederlo sul
        manico, <strong>+</strong> per aggiungerlo alla tua progressione.
      </p>

      <div className="x-build">
        <div className="x-build-head">
          <strong>La tua progressione</strong>
          <div className="sugg-actions">
            <button className="btn small" onClick={p.onPlayProgression} disabled={!p.progression.length}>
              {p.playingId === 'prog' ? '■ Stop' : '▶ Suona'}
            </button>
            <button className="btn small" onClick={p.onUndo} disabled={!p.canUndo}>
              ↶ Annulla
            </button>
            <button className="btn small" onClick={p.onClear} disabled={!p.progression.length}>
              Svuota
            </button>
            <button className="btn small primary" onClick={p.onOpen} disabled={!p.progression.length}>
              Analizza →
            </button>
          </div>
        </div>
        <div className="x-prog-chords">
          {p.progression.length ? (
            p.progression.map((c, i) => (
              <span key={i} className="x-pill">
                {P(c.symbol)}
              </span>
            ))
          ) : (
            <span className="muted small">Vuota: aggiungi accordi con +</span>
          )}
        </div>
      </div>

      {sel && (
        <div className="x-selected">
          <div className="board-head">
            <div>
              <strong>{P(sel.symbol)}</strong> <span className="muted">{P(sel.roman)}</span>
              {offset !== 0 && (
                <span className="muted">
                  {' '}
                  (suona {P(soundingChord(sel.chord, key, offset))}, {offsetLabel(offset)})
                </span>
              )}
            </div>
            <button className="btn small" onClick={() => p.onAdd(sel.symbol)}>
              + Aggiungi
            </button>
          </div>
          <Fretboard
            tuning={p.tuning}
            frets={p.instrument.frets}
            marks={voicing ? voicingMarks(voicing, sel.chord, p.tuning, key.names) : []}
            muted={voicing ? voicing.frets.flatMap((f, s) => (f === null ? [s] : [])) : []}
            names={key.names}
          />
        </div>
      )}

      <section className="x-section">
        <h3>Accordi della tonalità</h3>
        <div className="x-grid">{x.diatonic.map(card)}</div>
      </section>

      <section className="x-section">
        <h3>Accordi in prestito</h3>
        <p className="muted small">
          Presi dai modi con la stessa tonica: cambiano una o due note della scala e danno colore. ★ = tipici del {p.genre.name.toLowerCase()}.
        </p>
        {x.borrowed.map((g) => (
          <div key={g.mode} className="x-group">
            <div className="small">
              <strong>Da {g.label}</strong> <span className="muted">· {g.color}</span>
            </div>
            <div className="x-grid">{g.chords.map(card)}</div>
          </div>
        ))}
      </section>

      <section className="x-section">
        <h3>Dominanti secondarie</h3>
        <p className="muted small">Accordi di settima che "spingono" verso un accordo della tonalità: suonali subito prima del loro bersaglio.</p>
        <div className="x-grid">{x.secondary.map(card)}</div>
      </section>

      <section className="x-section">
        <h3>Progressioni da cui partire</h3>
        <p className="muted small">I giri tipici del {p.genre.name.toLowerCase()} in questa tonalità, dai più semplici a quelli con più prestiti.</p>
        <div className="x-progs">{common.map(progCard)}</div>
        {far.length > 0 && (
          <details className="x-more">
            <summary>Altre {far.length}, molto fuori tonalità</summary>
            <div className="x-progs">{far.map(progCard)}</div>
          </details>
        )}
      </section>
    </div>
  )
}
