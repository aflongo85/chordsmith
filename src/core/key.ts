import { Scale } from 'tonal'
import { FLAT_NAMES, SHARP_NAMES, mod12, pcOf, toSolfege } from './notes'
import { SCALES, type ModeId, type ScaleId } from './scales'

/** A tonal centre + mode, with the note spelling that goes with it. */
export interface KeyContext {
  tonicPc: number
  tonic: string
  mode: ModeId
  scalePcs: number[]
  /** pc → preferred spelling in this key (diatonic notes spelled correctly, others by sharp/flat preference) */
  names: string[]
  preferFlats: boolean
  label: string
}

function accidentalCount(notes: string[]): number {
  return notes.reduce((n, s) => n + (s.slice(1).match(/[#b]/g)?.length ?? 0), 0)
}

/** Best spelling (fewest accidentals) of a scale built on pc. */
export function spellScale(tonicPc: number, scale: ScaleId): { tonic: string; notes: string[] } {
  const def = SCALES[scale]
  const options = [...new Set([SHARP_NAMES[tonicPc], FLAT_NAMES[tonicPc]])].map((tonic) => ({
    tonic,
    notes: Scale.get(`${tonic} ${def.tonalName}`).notes,
  }))
  options.sort((a, b) => accidentalCount(a.notes) - accidentalCount(b.notes))
  return options[0]
}

export function makeKey(tonicPc: number, mode: ModeId): KeyContext {
  const pc = mod12(tonicPc)
  const { tonic, notes } = spellScale(pc, mode)
  const preferFlats = notes.some((n) => n.includes('b')) || (tonic.includes('b') && !notes.some((n) => n.includes('#')))
  const names = [...(preferFlats ? FLAT_NAMES : SHARP_NAMES)]
  const usedLetters = new Set(notes.map((n) => n[0]))
  const majorish = SCALES[mode].intervals.includes(4)
  for (let p = 0; p < 12; p++) {
    if (preferFlats) break
    const sharp = SHARP_NAMES[p]
    const flat = FLAT_NAMES[p]
    if (sharp === flat) continue
    const interval = mod12(p - pc)
    // chromatic notes: avoid reusing a letter of the scale; on a tie use the rock convention
    // (b3, b5, b6, b7 are flats), except the leading tone and the lydian #4 in major keys
    const sharpFree = !usedLetters.has(sharp[0])
    const flatFree = !usedLetters.has(flat[0])
    if (sharpFree !== flatFree) names[p] = sharpFree ? sharp : flat
    else names[p] = interval === 11 || (interval === 6 && majorish) ? sharp : flat
  }
  for (const n of notes) {
    const p = pcOf(n)
    if (p !== null) names[p] = n
  }
  return {
    tonicPc: pc,
    tonic,
    mode,
    scalePcs: SCALES[mode].intervals.map((i) => mod12(pc + i)),
    names,
    preferFlats,
    label: `${toSolfege(tonic)} ${SCALES[mode].label}`,
  }
}

export function scalePcs(tonicPc: number, scale: ScaleId): number[] {
  return SCALES[scale].intervals.map((i) => mod12(tonicPc + i))
}

export interface KeyCandidate {
  key: KeyContext
  score: number
  /** 0..1, relative to the other candidates */
  confidence: number
}

export type ModePriors = Partial<Record<ModeId, number>>

export const DEFAULT_MODE_PRIORS: Record<ModeId, number> = {
  ionian: 0.3,
  aeolian: 0.25,
  mixolydian: 0.1,
  dorian: 0.1,
  lydian: 0,
  phrygian: 0,
  locrian: -0.8,
}

export function priorFor(mode: ModeId, priors?: ModePriors): number {
  return priors?.[mode] ?? DEFAULT_MODE_PRIORS[mode]
}

export function rankCandidates(raw: { tonicPc: number; mode: ModeId; score: number }[], limit = 5): KeyCandidate[] {
  const sorted = [...raw].sort((a, b) => b.score - a.score)
  const top = sorted[0]?.score ?? 0
  const weights = sorted.map((c) => Math.exp((c.score - top) * 1.5))
  const total = weights.reduce((a, b) => a + b, 0) || 1
  return sorted.slice(0, limit).map((c, i) => ({
    key: makeKey(c.tonicPc, c.mode),
    score: c.score,
    confidence: weights[i] / total,
  }))
}
