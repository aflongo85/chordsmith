import { melodySuggestions } from './melodyRules'
import { progressionSuggestions } from './progressionRules'
import type { SuggestionProvider } from './types'

/** Deterministic, offline suggestions driven by music theory + the genre profile. */
export const rulesProvider: SuggestionProvider = {
  id: 'rules',
  name: 'Motore teorico',
  suggest(ctx) {
    const drafts = [
      ...(ctx.progression ? progressionSuggestions(ctx.progression, ctx.genre, ctx.instrument, ctx.tuning) : []),
      ...(ctx.melody && ctx.melodyNotes ? melodySuggestions(ctx.melodyNotes, ctx.melody, ctx.genre, ctx.tuning) : []),
    ]
    return drafts.map((d, i) => ({ ...d, id: `rules-${i}`, source: 'rules' }))
  },
}
