import { useState } from 'react'
import { prettyAccidentals as P } from '../core/notes'
import { getGenre } from '../genres'
import type { Idea } from '../state/store'

interface Props {
  ideas: Idea[]
  onSave: (name: string) => void
  onLoad: (idea: Idea) => void
  onDelete: (id: string) => void
}

export function IdeasPanel({ ideas, onSave, onLoad, onDelete }: Props) {
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const save = () => {
    onSave(name.trim() || `Idea ${ideas.length + 1}`)
    setName('')
  }
  return (
    <div className="panel">
      <div className="editor-row">
        <label className="field grow">
          <span>Salva progressione e riff correnti</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (es. Strofa v1)" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <button className="btn primary align-end" onClick={save}>
          Salva
        </button>
      </div>
      <p className="muted small">Le idee restano salvate in questo browser.</p>
      {ideas.length === 0 && <p className="muted">Nessuna idea salvata.</p>}
      <ul className="ideas">
        {[...ideas]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((idea) => (
            <li key={idea.id} className="idea">
              <div>
                <strong>{idea.name}</strong>
                <span className="muted small">
                  {' '}
                  · {getGenre(idea.genreId).name} · {new Date(idea.createdAt).toLocaleDateString('it-IT')}
                </span>
                {idea.progression && <code className="sugg-chords">{P(idea.progression)}</code>}
                {idea.melody && <code className="sugg-chords small">{idea.melody}</code>}
              </div>
              <div className="sugg-actions">
                <button className="btn small primary" onClick={() => onLoad(idea)}>
                  Apri
                </button>
                {confirm === idea.id ? (
                  <button className="btn small danger" onClick={() => onDelete(idea.id)}>
                    Conferma eliminazione
                  </button>
                ) : (
                  <button className="btn small" onClick={() => setConfirm(idea.id)}>
                    Elimina
                  </button>
                )}
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
}
