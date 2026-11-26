import type { KeyCandidate } from '../core/key'
import { keyOptions } from './helpers'

interface Props {
  value: string
  candidates: KeyCandidate[]
  onChange: (v: string) => void
}

export function KeySelect({ value, candidates, onChange }: Props) {
  const { suggested, all } = keyOptions(candidates)
  const detected = candidates[0]?.key.label
  return (
    <label className="field">
      <span>Tonalità</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="auto">Automatica{detected ? ` (${detected})` : ''}</option>
        {suggested.length > 0 && (
          <optgroup label="Candidate rilevate">
            {suggested.map((o) => (
              <option key={`s-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        )}
        {all.map((g) => (
          <optgroup key={g.mode} label={g.mode}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
