import type { MelodyNote } from '../core/melody'
import type { MelodyAnalysis } from '../core/melodyAnalysis'
import type { ProgressionAnalysis } from '../core/progression'
import type { GenreProfile } from '../genres/types'
import type { Instrument, Tuning } from '../instruments/types'

export type SuggestionKind =
  | 'prossimo accordo'
  | 'sostituzione'
  | 'variazione'
  | 'nuova sezione'
  | 'armonizzazione'
  | 'sviluppo melodico'
  | 'consiglio'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  title: string
  description: string
  /** a full replacement progression, if the suggestion has one */
  chords?: string[]
  /** a full replacement melody/riff, if the suggestion has one */
  melody?: MelodyNote[]
  /** for harmonizations: how many beats each chord lasts under the melody */
  beatsPerChord?: number
  /** 0..1, used for ordering inside a kind */
  score: number
  /** provider id, e.g. "rules" or "llm" */
  source: string
}

export interface SuggestionContext {
  genre: GenreProfile
  instrument: Instrument
  tuning: Tuning
  progression?: ProgressionAnalysis | null
  melody?: MelodyAnalysis | null
  melodyNotes?: MelodyNote[]
}

/**
 * Anything that can propose ideas. The built-in rule engine is one provider;
 * an LLM provider (see llm.ts) can be plugged in alongside it without touching the UI.
 */
export interface SuggestionProvider {
  id: string
  name: string
  suggest(ctx: SuggestionContext): Suggestion[] | Promise<Suggestion[]>
}
