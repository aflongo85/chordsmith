import { useState } from 'react'
import { formatMelody } from '../core/melody'
import { prettyAccidentals } from '../core/notes'
import type { Suggestion, SuggestionKind } from '../suggest'

const ORDER: SuggestionKind[] = [
  'prossimo accordo',
  'sostituzione',
  'variazione',
  'nuova sezione',
  'armonizzazione',
  'sviluppo melodico',
  'consiglio',
]

const TITLES: Record<SuggestionKind, string> = {
  'prossimo accordo': 'Prossimo accordo',
  sostituzione: 'Sostituzioni',
  variazione: 'Variazioni',
  'nuova sezione': 'Nuove sezioni',
  armonizzazione: 'Armonizzazioni',
  'sviluppo melodico': 'Sviluppi del motivo',
  consiglio: 'Consigli',
}

interface Props {
  suggestions: Suggestion[]
  playingId: string | null
  names: readonly string[]
  onListen: (s: Suggestion) => void
  onApply: (s: Suggestion) => void
}

export function SuggestionList({ suggestions, playingId, names, onListen, onApply }: Props) {
  const [open, setOpen] = useState<Partial<Record<SuggestionKind, boolean>>>({})
  const groups = ORDER.map((kind) => ({
    kind,
    items: suggestions.filter((s) => s.kind === kind).sort((a, b) => b.score - a.score),
  })).filter((g) => g.items.length)

  if (!groups.length)
    return <p className="muted">Scrivi qualche accordo o nota per ricevere idee.</p>

  return (
    <div className="suggestions">
      {groups.map(({ kind, items }) => {
        const expanded = open[kind] ?? false
        const shown = expanded ? items : items.slice(0, 3)
        return (
          <section key={kind} className="sugg-group">
            <h3>{TITLES[kind]}</h3>
            {shown.map((s) => (
              <article key={s.id} className={`sugg ${s.source === 'llm' ? 'sugg-ai' : ''}`}>
                <div className="sugg-head">
                  <strong>{prettyAccidentals(s.title)}</strong>
                  {s.source === 'llm' && <span className="badge">AI</span>}
                </div>
                <p>{prettyAccidentals(s.description)}</p>
                {s.chords && kind !== 'prossimo accordo' && <code className="sugg-chords">{prettyAccidentals(s.chords.join('  '))}</code>}
                {s.melody && kind === 'sviluppo melodico' && <code className="sugg-chords">{formatMelody(s.melody, names)}</code>}
                {(s.chords || s.melody) && (
                  <div className="sugg-actions">
                    <button className="btn small" onClick={() => onListen(s)}>
                      {playingId === s.id ? '■ Stop' : '▶ Ascolta'}
                    </button>
                    <button className="btn small primary" onClick={() => onApply(s)}>
                      {kind === 'armonizzazione' ? 'Usa come progressione' : 'Usa'}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {items.length > 3 && (
              <button className="link" onClick={() => setOpen({ ...open, [kind]: !expanded })}>
                {expanded ? 'Mostra meno' : `Altre ${items.length - 3} idee`}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
