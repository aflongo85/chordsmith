import type { ModePriors } from '../core/key'
import type { ScaleId } from '../core/scales'

export type SectionKind = 'strofa' | 'ritornello' | 'bridge' | 'intro' | 'qualsiasi'

export interface ProgressionTemplate {
  name: string
  /** roman tokens (see core/roman.ts), e.g. ["I", "bVII", "IV", "I"] */
  romans: string[]
  description: string
  section: SectionKind
}

export interface ColorChord {
  suffix: string
  weight: number
  label: string
}

/** 0..1 weights: how idiomatic each kind of harmonic move is in this genre. */
export interface SubstitutionWeights {
  relative: number
  modalInterchange: number
  secondaryDominant: number
  tritone: number
  chromaticMediant: number
  color: number
  power: number
  pedal: number
  retrograde: number
  keyChange: number
}

/**
 * Everything genre-specific lives here, so a new genre is just a new profile object
 * registered in genres/index.ts — the engine itself does not change.
 */
export interface GenreProfile {
  id: string
  name: string
  description: string
  modePriors: ModePriors
  /** from token → to token → weight */
  transitions: Record<string, Record<string, number>>
  colorChords: ColorChord[]
  substitutionWeights: SubstitutionWeights
  /** tokens commonly borrowed from parallel modes */
  borrowedPalette: string[]
  templates: ProgressionTemplate[]
  /** preferred scales for melodies/riffs, most idiomatic first */
  melodyScales: ScaleId[]
  tips: string[]
  defaultBpm: number
}
