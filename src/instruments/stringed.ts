import { mod12 } from '../core/notes'
import type { ParsedChord } from '../core/chords'
import type { Instrument, Position, Tuning, Voicing } from './types'

interface StringedOptions {
  id: string
  name: string
  tunings: Tuning[]
  frets: number
  polyphonic: boolean
  defaultOctave: number
}

const WINDOW = 4 // frets a hand can comfortably cover
const MAX_FINGERS = 4

function fingersNeeded(frets: (number | null)[]): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  if (fretted.length <= MAX_FINGERS) return fretted.length
  // barre on the lowest fret counts as a single finger
  const min = Math.min(...fretted)
  return 1 + fretted.filter((f) => f !== min).length
}

function evaluate(frets: (number | null)[], tuning: Tuning, chord: ParsedChord): number | null {
  const sounding = frets.map((f, i) => (f === null ? null : tuning.strings[i] + f))
  const notes = sounding.filter((m): m is number => m !== null)
  const isPower = chord.quality === 'power'
  if (notes.length < (isPower ? 2 : Math.min(3, chord.pcs.length))) return null
  if (isPower && notes.length > 3) return null

  // the lowest note must be the bass (root or slash bass)
  const bassPc = chord.bassPc ?? chord.rootPc
  if (mod12(notes[0]) !== bassPc) return null

  // every chord tone must be present; with 4+ tones the fifth may be dropped
  const present = new Set(notes.map(mod12))
  const fifth = mod12(chord.rootPc + 7)
  const missing = chord.pcs.filter((p) => !present.has(p))
  if (missing.length > 1 || (missing.length === 1 && (missing[0] !== fifth || chord.pcs.length < 4))) return null

  if (fingersNeeded(frets) > MAX_FINGERS) return null

  // muted strings: allowed below the bass and above the top note; one inside costs a lot
  const first = frets.findIndex((f) => f !== null)
  const last = frets.length - 1 - [...frets].reverse().findIndex((f) => f !== null)
  const innerMutes = frets.slice(first, last + 1).filter((f) => f === null).length
  if (innerMutes > 1) return null

  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const minFret = fretted.length ? Math.min(...fretted) : 0
  const span = fretted.length ? Math.max(...fretted) - minFret : 0
  const opens = frets.filter((f) => f === 0).length

  let score = notes.length * (isPower ? 0.2 : 1)
  score += opens * 0.6
  score -= minFret * 0.25
  score -= span * 0.3
  score -= innerMutes * 2
  if (isPower) score -= first * 0.3 // power chords sound best on the low strings
  else score -= (frets.length - 1 - last) * 0.4 // trailing mutes
  if (missing.length) score -= 0.5
  return score
}

export class StringedInstrument implements Instrument {
  readonly kind = 'stringed' as const
  readonly id: string
  readonly name: string
  readonly tunings: Tuning[]
  readonly frets: number
  readonly polyphonic: boolean
  readonly defaultOctave: number
  readonly tokenHelp: string

  constructor(opts: StringedOptions) {
    this.id = opts.id
    this.name = opts.name
    this.tunings = opts.tunings
    this.frets = opts.frets
    this.polyphonic = opts.polyphonic
    this.defaultOctave = opts.defaultOctave
    const n = opts.tunings[0].strings.length
    this.tokenHelp = `corda:tasto, es. "${n}:3" = corda ${n} (la più grave), 3° tasto`
  }

  voicings(chord: ParsedChord, tuning: Tuning): Voicing[] {
    return this.polyphonic ? this.chordVoicings(chord, tuning) : this.bassVoicings(chord, tuning)
  }

  private chordVoicings(chord: ParsedChord, tuning: Tuning, limit = 8): Voicing[] {
    const target = new Set(chord.pcs)
    const n = tuning.strings.length
    const seen = new Map<string, Voicing>()
    const maxStart = Math.min(this.frets - WINDOW, 12)

    for (let start = 0; start <= maxStart; start++) {
      const lo = Math.max(1, start)
      const hi = lo + WINDOW - 1
      const options: (number | null)[][] = tuning.strings.map((open) => {
        const opts: (number | null)[] = [null]
        if (target.has(mod12(open))) opts.push(0)
        for (let f = lo; f <= hi; f++) if (target.has(mod12(open + f))) opts.push(f)
        return opts
      })
      const current: (number | null)[] = new Array(n).fill(null)
      const walk = (s: number) => {
        if (s === n) {
          const score = evaluate(current, tuning, chord)
          if (score === null) return
          const key = current.map((f) => (f === null ? 'x' : f)).join('-')
          if (!seen.has(key) || seen.get(key)!.score < score) {
            seen.set(key, {
              frets: [...current],
              midi: current.flatMap((f, i) => (f === null ? [] : [tuning.strings[i] + f])),
              score,
            })
          }
          return
        }
        for (const o of options[s]) {
          current[s] = o
          walk(s + 1)
        }
        current[s] = null
      }
      walk(0)
    }
    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  }

  private bassVoicings(chord: ParsedChord, tuning: Tuning): Voicing[] {
    const pc = chord.bassPc ?? chord.rootPc
    const out: Voicing[] = []
    tuning.strings.forEach((open, s) => {
      for (let f = 0; f <= 12; f++) {
        if (mod12(open + f) !== pc) continue
        const frets: (number | null)[] = tuning.strings.map(() => null)
        frets[s] = f
        out.push({ frets, midi: [open + f], score: -f * 0.3 - s * 0.5 })
      }
    })
    return out.sort((a, b) => b.score - a.score).slice(0, 6)
  }

  positionsOf(midi: number, tuning: Tuning): Position[] {
    const out: Position[] = []
    tuning.strings.forEach((open, s) => {
      const f = midi - open
      if (f >= 0 && f <= this.frets) out.push({ string: s, fret: f })
    })
    return out
  }

  /** "6:3" → string 6 (lowest on a 6-string), fret 3. Strings are numbered from the highest (1) like in tab. */
  parseToken(token: string, tuning: Tuning): number | null {
    const m = /^(\d+)[:.](\d+)$/.exec(token)
    if (!m) return null
    const stringNo = Number(m[1])
    const fret = Number(m[2])
    const n = tuning.strings.length
    if (stringNo < 1 || stringNo > n || fret > this.frets) return null
    return tuning.strings[n - stringNo] + fret
  }
}
