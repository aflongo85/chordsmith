import { SHARP_NAMES, midiOf, midiToName, mod12, pcOf } from './notes'
import type { Instrument, Tuning } from '../instruments/types'

/** A note (or rest when midi is null). dur is in beats: 1 = quarter note. */
export interface MelodyNote {
  midi: number | null
  dur: number
}

const DURATIONS: Record<string, number> = { '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25 }
const RESTS = new Set(['r', 'R', '-', '_', 'p', 'P'])

function parseDuration(s: string | undefined): number | null {
  if (s === undefined || s === '') return 1
  const dotted = s.endsWith('.')
  const base = DURATIONS[dotted ? s.slice(0, -1) : s]
  if (base === undefined) return null
  return dotted ? base * 1.5 : base
}

function nearest(pc: number, ref: number): number {
  const base = ref - mod12(ref) + pc
  const options = [base - 12, base, base + 12]
  return options.reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a))
}

/**
 * Parses notes like "E2 G2/8 A2/8 r/4 Bb2" or instrument tokens like "6:0 6:3/8".
 * A note without octave goes to the octave closest to the previous note.
 */
export function parseMelody(
  text: string,
  instrument: Instrument,
  tuning: Tuning,
): { notes: MelodyNote[]; errors: string[] } {
  const notes: MelodyNote[] = []
  const errors: string[] = []
  let prev: number | null = null
  for (const raw of text.split(/[\s,|]+/).filter(Boolean)) {
    const slash = raw.lastIndexOf('/')
    const body = slash > 0 ? raw.slice(0, slash) : raw
    const dur = parseDuration(slash > 0 ? raw.slice(slash + 1) : undefined)
    if (dur === null) {
      errors.push(raw)
      continue
    }
    if (RESTS.has(body)) {
      notes.push({ midi: null, dur })
      continue
    }
    const clean = body.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/^([a-g])/, (m) => m.toUpperCase())
    let midi = instrument.parseToken(clean, tuning)
    if (midi === null) {
      if (/\d$/.test(clean)) midi = midiOf(clean)
      else {
        const pc = pcOf(clean)
        if (pc !== null) midi = prev === null ? (instrument.defaultOctave + 1) * 12 + pc : nearest(pc, prev)
      }
    }
    if (midi === null) {
      errors.push(raw)
      continue
    }
    notes.push({ midi, dur })
    prev = midi
  }
  return { notes, errors }
}

function durationSuffix(dur: number): string {
  if (dur === 1) return ''
  for (const [k, v] of Object.entries(DURATIONS)) {
    if (v === dur) return `/${k}`
    if (v * 1.5 === dur) return `/${k}.`
  }
  return ''
}

export function formatMelody(notes: MelodyNote[], names: readonly string[] = SHARP_NAMES): string {
  return notes.map((n) => (n.midi === null ? 'r' : midiToName(n.midi, names)) + durationSuffix(n.dur)).join(' ')
}

export const totalBeats = (notes: MelodyNote[]): number => notes.reduce((a, n) => a + n.dur, 0)

// ---------------------------------------------------------------- scale-aware helpers

/** All MIDI notes (0-127) that belong to the scale, ascending. */
function scaleLadder(pcs: number[]): number[] {
  const set = new Set(pcs)
  const out: number[] = []
  for (let m = 0; m < 128; m++) if (set.has(mod12(m))) out.push(m)
  return out
}

/** Index on the ladder of the scale tone closest to midi. */
function ladderIndex(ladder: number[], midi: number): number {
  let best = 0
  for (let i = 1; i < ladder.length; i++) if (Math.abs(ladder[i] - midi) < Math.abs(ladder[best] - midi)) best = i
  return best
}

export function snapToScale(midi: number, pcs: number[]): number {
  const ladder = scaleLadder(pcs)
  return ladder[ladderIndex(ladder, midi)]
}

const mapPitched = (notes: MelodyNote[], f: (m: number) => number): MelodyNote[] =>
  notes.map((n) => (n.midi === null ? n : { ...n, midi: f(n.midi) }))

/** Moves every note by `steps` scale degrees. */
export function transposeDiatonic(notes: MelodyNote[], steps: number, pcs: number[]): MelodyNote[] {
  const ladder = scaleLadder(pcs)
  return mapPitched(notes, (m) => {
    const i = Math.min(Math.max(ladderIndex(ladder, m) + steps, 0), ladder.length - 1)
    // keep chromatic notes chromatic: apply the same offset they had from their snapped tone
    return ladder[i] + (m - ladder[ladderIndex(ladder, m)])
  })
}

/** Mirror image around the first note, measured in scale degrees. */
export function invertDiatonic(notes: MelodyNote[], pcs: number[]): MelodyNote[] {
  const ladder = scaleLadder(pcs)
  const first = notes.find((n) => n.midi !== null)?.midi
  if (first === undefined || first === null) return notes
  const pivot = ladderIndex(ladder, first)
  return mapPitched(notes, (m) => {
    const i = Math.min(Math.max(2 * pivot - ladderIndex(ladder, m), 0), ladder.length - 1)
    return ladder[i]
  })
}

export const retrograde = (notes: MelodyNote[]): MelodyNote[] => [...notes].reverse()

export const scaleRhythm = (notes: MelodyNote[], factor: number): MelodyNote[] =>
  notes.map((n) => ({ ...n, dur: n.dur * factor }))

/** Starts the phrase half a beat later (rhythmic displacement / syncopation). */
export const displace = (notes: MelodyNote[], beats = 0.5): MelodyNote[] => [{ midi: null, dur: beats }, ...notes]

/** Alternates each note with a low pedal tone, the classic open-string riff. */
export function pedalize(notes: MelodyNote[], pedal: number): MelodyNote[] {
  return notes.flatMap((n) =>
    n.midi === null || n.midi === pedal ? [n] : [{ midi: pedal, dur: n.dur / 2 }, { midi: n.midi, dur: n.dur / 2 }],
  )
}

/** Call & response: repeats the phrase and makes the copy land on the tonic. */
export function answerPhrase(notes: MelodyNote[], tonicPc: number, pcs: number[]): MelodyNote[] {
  const pitched = notes.map((n, i) => ({ n, i })).filter((x) => x.n.midi !== null)
  if (pitched.length < 2) return notes
  const copy = notes.map((n) => ({ ...n }))
  const lastIdx = pitched[pitched.length - 1].i
  const lastMidi = copy[lastIdx].midi as number
  const tonic = nearest(tonicPc, lastMidi)
  copy[lastIdx] = { midi: tonic, dur: Math.max(copy[lastIdx].dur, 1) }
  const prevIdx = pitched[pitched.length - 2].i
  // approach the tonic by step from above (2nd degree) for a smooth resolution
  copy[prevIdx] = { ...copy[prevIdx], midi: snapToScale(tonic + 2, pcs) }
  return [...notes, ...copy]
}

/** A motif repeated three times, each a scale step higher. */
export function sequence(notes: MelodyNote[], pcs: number[], step = 1): MelodyNote[] {
  return [...notes, ...transposeDiatonic(notes, step, pcs), ...transposeDiatonic(notes, step * 2, pcs)]
}
