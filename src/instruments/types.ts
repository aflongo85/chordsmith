import type { ParsedChord } from '../core/chords'

export interface Tuning {
  id: string
  name: string
  /**
   * MIDI note of each open string, lowest string first, as the player *thinks* it.
   * Fingerings, note names and analysis all use these values.
   */
  strings: number[]
  /**
   * Semitones between what is fingered and what actually sounds. A guitar tuned down
   * a half step is "standard" with offset -1: an E minor shape is fingered and named Em,
   * but sounds as Ebm. Only playback applies it. 0 for tunings that change the shapes.
   */
  offset: number
}

export interface Voicing {
  /** fret per string (lowest first); null = muted. For non-stringed instruments: empty. */
  frets: (number | null)[]
  midi: number[]
  score: number
}

export interface Position {
  /** 0 = lowest string */
  string: number
  fret: number
}

/**
 * An instrument the app can show, voice and play. Adding a new one (piano, ukulele…)
 * means implementing this interface and registering it in instruments/index.ts;
 * `kind` tells the UI which board component to render.
 */
export interface Instrument {
  id: string
  name: string
  kind: 'stringed' | 'keyboard'
  /** plays full chords (guitar) or just bass notes (bass guitar) */
  polyphonic: boolean
  tunings: Tuning[]
  frets: number
  voicings(chord: ParsedChord, tuning: Tuning): Voicing[]
  /** where a MIDI note can be played (used to show melodies on the board) */
  positionsOf(midi: number, tuning: Tuning): Position[]
  /** instrument-specific note tokens, e.g. "6:3" = 6th string, 3rd fret. Returns MIDI or null. */
  parseToken(token: string, tuning: Tuning): number | null
  /** typical register for melodies, used when a note is typed without octave */
  defaultOctave: number
  /** short help text for the notation accepted by parseToken */
  tokenHelp: string
}
