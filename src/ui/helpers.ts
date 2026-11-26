import { parseChord, type ParsedChord } from '../core/chords'
import { makeKey, type KeyCandidate, type KeyContext } from '../core/key'
import { mod12 } from '../core/notes'
import { MODE_IDS, SCALES, type ModeId } from '../core/scales'
import type { Instrument, Tuning, Voicing } from '../instruments/types'
import type { Mark } from './Fretboard'

const cache = new Map<string, Voicing[]>()

export function voicingsFor(chord: ParsedChord, instrument: Instrument, tuning: Tuning): Voicing[] {
  const k = `${instrument.id}|${tuning.id}|${chord.symbol}`
  let v = cache.get(k)
  if (!v) {
    v = instrument.voicings(chord, tuning)
    cache.set(k, v)
  }
  return v
}

/** Notes to play for a chord: the best instrument voicing, or a close-position fallback. */
export function chordMidi(chord: ParsedChord, instrument: Instrument, tuning: Tuning): number[] {
  const v = voicingsFor(chord, instrument, tuning)[0]
  if (v) return v.midi
  const root = 48 + chord.rootPc
  return chord.intervals.map((i) => root + i)
}

export function symbolMidi(symbol: string, instrument: Instrument, tuning: Tuning): number[] {
  const c = parseChord(symbol)
  return c ? chordMidi(c, instrument, tuning) : []
}

export function voicingMarks(v: Voicing, chord: ParsedChord, tuning: Tuning, names: readonly string[]): Mark[] {
  return v.frets.flatMap((f, s) => {
    if (f === null) return []
    const pc = mod12(tuning.strings[s] + f)
    return [{ string: s, fret: f, kind: pc === chord.rootPc ? 'root' : 'tone', label: names[pc] } as Mark]
  })
}

export function scaleMarks(key: KeyContext, tuning: Tuning, frets: number): Mark[] {
  const pcs = new Set(key.scalePcs)
  const out: Mark[] = []
  tuning.strings.forEach((open, s) => {
    for (let f = 0; f <= frets; f++) {
      const pc = mod12(open + f)
      if (pcs.has(pc)) out.push({ string: s, fret: f, kind: pc === key.tonicPc ? 'scaleRoot' : 'scale' })
    }
  })
  return out
}

export function parseKeyChoice(value: string): KeyContext | undefined {
  if (value === 'auto') return undefined
  const [pc, mode] = value.split(':')
  if (!MODE_IDS.includes(mode as ModeId)) return undefined
  return makeKey(Number(pc), mode as ModeId)
}

export const keyValue = (k: KeyContext) => `${k.tonicPc}:${k.mode}`

export interface KeyOption {
  value: string
  label: string
}

export function keyOptions(candidates: KeyCandidate[]): { suggested: KeyOption[]; all: { mode: string; options: KeyOption[] }[] } {
  return {
    suggested: candidates.slice(0, 4).map((c) => ({ value: keyValue(c.key), label: `${c.key.label} (${Math.round(c.confidence * 100)}%)` })),
    all: MODE_IDS.filter((m) => m !== 'locrian').map((mode) => ({
      mode: SCALES[mode].label,
      options: Array.from({ length: 12 }, (_, pc) => {
        const k = makeKey(pc, mode)
        return { value: keyValue(k), label: k.label }
      }),
    })),
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)
