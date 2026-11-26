import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { parseProgression, type ParsedChord } from './core/chords'
import { formatMelody, parseMelody } from './core/melody'
import { analyzeMelody } from './core/melodyAnalysis'
import { makeKey } from './core/key'
import { midiToName, SHARP_NAMES } from './core/notes'
import { analyzeProgression } from './core/progression'
import { GENRES, getGenre } from './genres'
import { INSTRUMENTS, getInstrument, getTuning } from './instruments'
import { play, previewNotes, setCrunch, setTranspose, stop, warmUp, type PlayOptions } from './audio/player'
import { collectSuggestions, type Suggestion, type SuggestionContext } from './suggest'
import { usePersistentState, type Tab } from './state/store'
import { useIdeaSync } from './sync/useIdeaSync'
import { chordMidi, keyValue, parseKeyChoice, symbolMidi, uid, voicingsFor } from './ui/helpers'
import { ExplorePanel } from './ui/ExplorePanel'
import { ProgressionPanel } from './ui/ProgressionPanel'
import { MelodyPanel } from './ui/MelodyPanel'
import { IdeasPanel } from './ui/IdeasPanel'
import { SuggestionList } from './ui/SuggestionList'

const TABS: { id: Tab; label: string }[] = [
  { id: 'esplora', label: 'Esplora tonalità' },
  { id: 'progressione', label: 'Progressione' },
  { id: 'melodia', label: 'Riff / Melodia' },
  { id: 'idee', label: 'Idee salvate' },
]

export default function App() {
  const [st, update, updateIdeas] = usePersistentState()
  const sync = useIdeaSync(st.ideas, updateIdeas)
  const genre = getGenre(st.genreId)
  const instrument = getInstrument(st.instrumentId)
  const tuning = getTuning(instrument, st.tuningId)

  // ------------------------------------------------------------ analysis
  const progText = useDeferredValue(st.progression)
  const melText = useDeferredValue(st.melody)
  const prog = useMemo(() => parseProgression(progText), [progText])
  const progAnalysis = useMemo(() => {
    const k = parseKeyChoice(st.progressionKey)
    return analyzeProgression(prog.chords, genre, k && { tonicPc: k.tonicPc, mode: k.mode })
  }, [prog, genre, st.progressionKey])
  const mel = useMemo(() => parseMelody(melText, instrument, tuning), [melText, instrument, tuning])
  const melAnalysis = useMemo(
    () => analyzeMelody(mel.notes, genre.modePriors, genre.melodyScales, parseKeyChoice(st.melodyKey)),
    [mel, genre, st.melodyKey],
  )
  const melNames = melAnalysis?.key.names ?? SHARP_NAMES
  const exploreKeyCtx = parseKeyChoice(st.exploreKey) ?? makeKey(4, 'aeolian')

  // ------------------------------------------------------------ suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  useEffect(() => {
    const base = { genre, instrument, tuning }
    const ctx: SuggestionContext | null =
      st.tab === 'progressione'
        ? { ...base, progression: progAnalysis }
        : st.tab === 'melodia'
          ? { ...base, melody: melAnalysis, melodyNotes: mel.notes }
          : null
    if (!ctx) return
    let cancelled = false
    void collectSuggestions(ctx).then((s) => {
      if (!cancelled) setSuggestions(s)
    })
    return () => {
      cancelled = true
    }
  }, [st.tab, progAnalysis, melAnalysis, mel.notes, genre, instrument, tuning])

  // ------------------------------------------------------------ playback
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [activeChord, setActiveChord] = useState<number | null>(null)
  const [activeNote, setActiveNote] = useState<number | null>(null)

  const stopAll = () => {
    stop()
    setPlayingId(null)
    setActiveChord(null)
    setActiveNote(null)
  }
  useEffect(() => stop, [])
  // prepare the guitar sound in the background so the first ▶ is instant
  useEffect(() => {
    const t = setTimeout(() => void warmUp(), 1200)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => setCrunch(st.crunch), [st.crunch])
  useEffect(() => setTranspose(tuning.offset), [tuning.offset])

  const toggle = (id: string, opts: Omit<PlayOptions, 'bpm' | 'onEnd'>) => {
    if (playingId === id) return stopAll()
    stopAll()
    setPlayingId(id)
    void play({ ...opts, bpm: st.bpm, onEnd: stopAll })
  }

  const progEvents = (chords: ParsedChord[], beats: number) =>
    chords.map((c) => ({ midi: chordMidi(c, instrument, tuning), beats }))

  // part of the progression to play (indices, inclusive); clamped when chords are removed
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const last = Math.max(0, prog.chords.length - 1)
  const loopRange = range && range.from <= last ? { from: range.from, to: Math.min(range.to, last) } : { from: 0, to: last }

  const startProgression = (loop: boolean, r: { from: number; to: number }) => {
    stopAll()
    if (!prog.chords.length) return
    setPlayingId('prog')
    void play({
      chords: progEvents(prog.chords.slice(r.from, r.to + 1), st.beatsPerChord),
      loop,
      bpm: st.bpm,
      onChord: (i) => setActiveChord(r.from + i),
      onEnd: stopAll,
    })
  }
  const playProgression = () => (playingId === 'prog' ? stopAll() : startProgression(st.loop, loopRange))
  const setLoop = (loop: boolean) => {
    update({ loop })
    if (playingId === 'prog') startProgression(loop, loopRange)
  }
  const changeRange = (r: { from: number; to: number }) => {
    const fixed = { from: Math.min(r.from, r.to), to: Math.max(r.from, r.to) }
    setRange(fixed.from === 0 && fixed.to === last ? null : fixed)
    if (playingId === 'prog') startProgression(st.loop, fixed)
  }

  const playMelody = () =>
    toggle('mel', {
      melody: mel.notes,
      chords: st.withChords && prog.chords.length ? progEvents(prog.chords, st.beatsPerChord) : undefined,
      loop: true,
      onNote: setActiveNote,
    })

  const listen = (s: Suggestion) =>
    toggle(s.id, {
      chords: s.chords?.map((sym) => ({ midi: symbolMidi(sym, instrument, tuning), beats: s.beatsPerChord ?? Math.min(st.beatsPerChord, 2) })),
      melody: s.melody,
    })

  const previewChord = (c: ParsedChord, voicing: number) => {
    const v = voicingsFor(c, instrument, tuning)[voicing]
    void previewNotes(v ? v.midi : chordMidi(c, instrument, tuning))
  }

  // ------------------------------------------------------------ editing with undo
  const [history, setHistory] = useState<{ progression: string[]; melody: string[] }>({ progression: [], melody: [] })
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const [future, setFuture] = useState<{ progression: string[]; melody: string[] }>({ progression: [], melody: [] })
  const replace = (field: 'progression' | 'melody', value: string, message?: string) => {
    if (st[field] === value) return
    setHistory((h) => ({ ...h, [field]: [...h[field], st[field]] }))
    setFuture((f) => ({ ...f, [field]: [] }))
    update({ [field]: value })
    if (message) setToast(message)
  }
  const undo = (field: 'progression' | 'melody') => {
    const prev = history[field][history[field].length - 1]
    if (prev === undefined) return
    setHistory((h) => ({ ...h, [field]: h[field].slice(0, -1) }))
    setFuture((f) => ({ ...f, [field]: [...f[field], st[field]] }))
    update({ [field]: prev })
  }
  const redo = (field: 'progression' | 'melody') => {
    const next = future[field][future[field].length - 1]
    if (next === undefined) return
    setFuture((f) => ({ ...f, [field]: f[field].slice(0, -1) }))
    setHistory((h) => ({ ...h, [field]: [...h[field], st[field]] }))
    update({ [field]: next })
  }
  /** typing starts a new branch of history: nothing left to redo */
  const type = (field: 'progression' | 'melody', value: string) => {
    if (future[field].length) setFuture((f) => ({ ...f, [field]: [] }))
    update({ [field]: value })
  }

  const apply = (s: Suggestion) => {
    stopAll()
    if (s.chords) {
      replace('progression', s.chords.join(' '), s.kind === 'armonizzazione' ? 'Accordi copiati nella progressione' : 'Progressione aggiornata')
      if (s.kind === 'armonizzazione') update({ withChords: true, beatsPerChord: s.beatsPerChord ?? st.beatsPerChord, progressionKey: 'auto' })
    }
    if (s.melody && s.kind !== 'armonizzazione') replace('melody', formatMelody(s.melody, melNames), 'Riff aggiornato')
  }

  // ------------------------------------------------------------ render
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ♪
          </span>
          <div>
            <h1>Chordsmith</h1>
            <p className="muted small">{genre.description}</p>
          </div>
        </div>
        <div className="settings">
          <label className="field">
            <span>Genere</span>
            <select value={genre.id} onChange={(e) => update({ genreId: e.target.value })}>
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Strumento</span>
            <select
              value={instrument.id}
              onChange={(e) => update({ instrumentId: e.target.value, tuningId: getInstrument(e.target.value).tunings[0].id })}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Accordatura</span>
            <select value={tuning.id} onChange={(e) => update({ tuningId: e.target.value })}>
              {instrument.tunings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field narrow">
            <span>BPM</span>
            <input
              type="number"
              min={40}
              max={240}
              value={st.bpm}
              onChange={(e) => update({ bpm: Math.max(40, Math.min(240, Number(e.target.value) || 100)) })}
            />
          </label>
          <label className="field narrow">
            <span>Tempi/accordo</span>
            <select value={st.beatsPerChord} onChange={(e) => update({ beatsPerChord: Number(e.target.value) })}>
              {[1, 2, 4, 8].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="check toggle">
            <input type="checkbox" checked={st.crunch} onChange={(e) => update({ crunch: e.target.checked })} /> Distorsione
          </label>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={st.tab === t.id}
            className={st.tab === t.id ? 'tab active' : 'tab'}
            onClick={() => {
              stopAll()
              setSuggestions([])
              update({ tab: t.id })
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className={st.tab === 'idee' || st.tab === 'esplora' ? 'layout single' : 'layout'}>
        <section className="main-col">
          {st.tab === 'esplora' && (
            <ExplorePanel
              exploreKey={exploreKeyCtx}
              progressionKey={progAnalysis?.key ?? null}
              genre={genre}
              instrument={instrument}
              tuning={tuning}
              progression={prog.chords}
              playingId={playingId}
              canUndo={history.progression.length > 0}
              canRedo={future.progression.length > 0}
              onRedo={() => redo('progression')}
              onKey={(k) => update({ exploreKey: k })}
              onPreview={(c) => previewChord(c, 0)}
              onAdd={(sym) => replace('progression', `${st.progression.trim()} ${sym}`.trim())}
              onListen={(id, symbols) =>
                toggle(id, { chords: symbols.map((sym) => ({ midi: symbolMidi(sym, instrument, tuning), beats: Math.min(st.beatsPerChord, 2) })) })
              }
              onUse={(symbols) => {
                stopAll()
                replace('progression', symbols.join(' '), 'Progressione sostituita: Annulla per tornare indietro')
                update({ progressionKey: keyValue(exploreKeyCtx) })
              }}
              onPlayProgression={playProgression}
              onUndo={() => undo('progression')}
              onClear={() => {
                stopAll()
                replace('progression', '', 'Progressione svuotata')
              }}
              onOpen={() => {
                stopAll()
                // let the analysis find the key: the chords may come from elsewhere
                update({ tab: 'progressione', progressionKey: 'auto' })
              }}
            />
          )}
          {st.tab === 'progressione' && (
            <ProgressionPanel
              text={st.progression}
              errors={prog.errors}
              analysis={progAnalysis}
              keyChoice={st.progressionKey}
              instrument={instrument}
              tuning={tuning}
              activeChord={playingId === 'prog' ? activeChord : null}
              playing={playingId === 'prog'}
              canUndo={history.progression.length > 0}
              canRedo={future.progression.length > 0}
              onRedo={() => redo('progression')}
              onText={(t) => type('progression', t)}
              onKey={(k) => update({ progressionKey: k })}
              onPlay={playProgression}
              genre={genre}
              fallbackKey={exploreKeyCtx}
              onListenSymbol={(sym) => void previewNotes(symbolMidi(sym, instrument, tuning))}
              onChords={(t) => replace('progression', t)}
              loop={st.loop}
              loopRange={loopRange}
              onLoop={setLoop}
              onRange={changeRange}
              onUndo={() => undo('progression')}
              onPreview={previewChord}
            />
          )}
          {st.tab === 'melodia' && (
            <MelodyPanel
              text={st.melody}
              notes={mel.notes}
              errors={mel.errors}
              analysis={melAnalysis}
              keyChoice={st.melodyKey}
              instrument={instrument}
              tuning={tuning}
              activeNote={playingId === 'mel' ? activeNote : null}
              playing={playingId === 'mel'}
              withChords={st.withChords}
              hasChords={prog.chords.length > 0}
              canUndo={history.melody.length > 0}
              canRedo={future.melody.length > 0}
              onRedo={() => redo('melody')}
              onText={(t) => type('melody', t)}
              onKey={(k) => update({ melodyKey: k })}
              onPlay={playMelody}
              onUndo={() => undo('melody')}
              onWithChords={(v) => update({ withChords: v })}
              onPick={(midi) => {
                void previewNotes([midi])
                update({ melody: `${st.melody.trim()} ${midiToName(midi, melNames)}`.trim() })
              }}
            />
          )}
          {st.tab === 'idee' && (
            <IdeasPanel
              ideas={st.ideas.filter((i) => !i.deleted)}
              sync={sync}
              onSave={(name) => {
                const now = Date.now()
                updateIdeas((ideas) => [
                  ...ideas,
                  { id: uid(), name, progression: st.progression, melody: st.melody, genreId: st.genreId, createdAt: now, updatedAt: now },
                ])
                setToast('Idea salvata')
              }}
              onLoad={(idea) => {
                setHistory((h) => ({ progression: [...h.progression, st.progression], melody: [...h.melody, st.melody] }))
                setFuture({ progression: [], melody: [] })
                update({ progression: idea.progression, melody: idea.melody, genreId: idea.genreId, tab: 'progressione', progressionKey: 'auto', melodyKey: 'auto' })
              }}
              onDelete={(id) =>
                // keep a tombstone so the deletion reaches the other devices
                updateIdeas((ideas) => ideas.map((i) => (i.id === id ? { ...i, deleted: true, updatedAt: Date.now() } : i)))
              }
            />
          )}
        </section>
        {st.tab !== 'idee' && st.tab !== 'esplora' && (
          <aside className="side-col">
            <h2>Idee per sviluppare</h2>
            <SuggestionList
              suggestions={suggestions}
              playingId={playingId}
              names={melNames}
              onListen={listen}
              onApply={apply}
            />
          </aside>
        )}
      </main>
      <footer className="credits muted small">
        Campioni di chitarra elettrica:{' '}
        <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noreferrer">
          tonejs-instruments
        </a>{' '}
        di Nicholaus Brosowsky, registrazioni di Karoryfer, licenza{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
          CC BY 3.0
        </a>
        .
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
