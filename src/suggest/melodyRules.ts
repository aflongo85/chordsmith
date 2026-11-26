import { candidateChords, type CandidateChord } from '../core/harmony'
import type { KeyContext } from '../core/key'
import {
  answerPhrase,
  displace,
  invertDiatonic,
  pedalize,
  retrograde,
  scaleRhythm,
  sequence,
  totalBeats,
  transposeDiatonic,
  type MelodyNote,
} from '../core/melody'
import type { MelodyAnalysis } from '../core/melodyAnalysis'
import { mod12 } from '../core/notes'
import { chordSymbol, parseChord } from '../core/chords'
import type { GenreProfile } from '../genres/types'
import type { Tuning } from '../instruments/types'
import type { Suggestion } from './types'

type Draft = Omit<Suggestion, 'id' | 'source'>

// ---------------------------------------------------------------- harmonization

function segmentLength(beats: number): number {
  if (beats <= 4) return 1
  if (beats <= 8) return 2
  return 4
}

interface Segment {
  weights: Map<number, number>
  /** lowest note of the segment: in riffs it usually implies the chord root */
  lowest: number | null
}

function segments(notes: MelodyNote[], len: number): Segment[] {
  const out: Segment[] = []
  let t = 0
  for (const n of notes) {
    const idx = Math.floor(t / len + 1e-9)
    while (out.length <= idx) out.push({ weights: new Map(), lowest: null })
    if (n.midi !== null) {
      const seg = out[idx]
      const isFirst = Math.abs(t - idx * len) < 1e-9
      const pc = mod12(n.midi)
      seg.weights.set(pc, (seg.weights.get(pc) ?? 0) + n.dur * (isFirst ? 1.5 : 1))
      if (seg.lowest === null || n.midi < seg.lowest) seg.lowest = n.midi
    }
    t += n.dur
  }
  return out
}

function fitScore(seg: Segment, cand: CandidateChord): number {
  const pcs = new Set(cand.chord.pcs)
  let s = 0
  for (const [pc, w] of seg.weights) {
    if (pcs.has(pc)) s += w
    else if (cand.chord.pcs.some((p) => Math.abs(mod12(p - pc + 6) - 6) === 1)) s -= 0.6 * w // semitone clash
    else s -= 0.15 * w
  }
  if (seg.lowest !== null && mod12(seg.lowest) === cand.chord.rootPc) s += 0.5
  return s
}

export function harmonize(
  notes: MelodyNote[],
  key: KeyContext,
  genre: GenreProfile,
  allowBorrowed: boolean,
): { chords: string[]; beatsPerChord: number } {
  const len = segmentLength(totalBeats(notes))
  const segs = segments(notes, len)
  const cands = candidateChords(key, allowBorrowed ? genre.borrowedPalette : [])
  const chords: CandidateChord[] = []
  segs.forEach((seg, i) => {
    const prev = chords[i - 1]
    let best = cands[0]
    let bestScore = -Infinity
    for (const c of cands) {
      let s = fitScore(seg, c)
      if (!c.diatonic) s -= allowBorrowed ? 0.15 : 1
      if (c.chord.quality === 'dim') s -= 0.6 // rarely idiomatic in rock
      if (prev) {
        const row = genre.transitions[prev.token] ?? {}
        s += 0.12 * (row[c.token] ?? 0)
        if (prev.symbol === c.symbol) s -= 0.2 // prefer movement
      }
      if ((i === 0 || i === segs.length - 1) && c.chord.rootPc === key.tonicPc) s += 1
      if (seg.weights.size === 0 && prev) s = c.symbol === prev.symbol ? 10 : s // rests: hold the chord
      if (s > bestScore) {
        bestScore = s
        best = c
      }
    }
    chords.push(best)
  })
  return { chords: chords.map((c) => c.symbol), beatsPerChord: len }
}

// ---------------------------------------------------------------- motif development

function firstMotifNotes(notes: MelodyNote[], a: MelodyAnalysis): MelodyNote[] {
  const m = a.motifs[0]
  if (!m || notes.length <= 8) return notes
  // map pitched-index → notes index
  const pitchedIdx = notes.map((n, i) => ({ n, i })).filter((x) => x.n.midi !== null).map((x) => x.i)
  const from = pitchedIdx[m.starts[0]]
  const to = pitchedIdx[m.starts[0] + m.intervals.length]
  return notes.slice(from, to + 1)
}

function lowestTonic(a: MelodyAnalysis, tuning: Tuning): number {
  const low = Math.min(...a.pitched)
  let p = low - mod12(low - a.key.tonicPc)
  if (p < tuning.strings[0]) p += 12
  return p
}

export function melodySuggestions(notes: MelodyNote[], a: MelodyAnalysis, g: GenreProfile, tuning: Tuning): Draft[] {
  const pcs = a.key.scalePcs
  const w = g.substitutionWeights
  const out: Draft[] = []

  const diat = harmonize(notes, a.key, g, false)
  out.push({
    kind: 'armonizzazione',
    title: `Armonizzazione diatonica: ${diat.chords.join(' ')}`,
    description: `Un accordo ogni ${diat.beatsPerChord} ${diat.beatsPerChord === 1 ? 'tempo' : 'tempi'}, scelto per coprire le note più lunghe e accentate restando in ${a.key.tonic}.`,
    chords: diat.chords,
    melody: notes,
    beatsPerChord: diat.beatsPerChord,
    score: 0.8,
  })
  const rock = harmonize(notes, a.key, g, true)
  if (rock.chords.join() !== diat.chords.join()) {
    out.push({
      kind: 'armonizzazione',
      title: `Armonizzazione con prestiti: ${rock.chords.join(' ')}`,
      description: `Ammette accordi presi dai modi paralleli (${g.borrowedPalette.slice(0, 4).join(', ')}) come nel ${g.name.toLowerCase()}.`,
      chords: rock.chords,
      melody: notes,
      beatsPerChord: rock.beatsPerChord,
      score: 0.75 + w.modalInterchange * 0.1,
    })
  }
  if (w.power >= 0.6) {
    const power = rock.chords.map((s) => {
      const c = parseChord(s)
      return c ? chordSymbol(c.rootPc, '5', a.key) : s
    })
    out.push({
      kind: 'armonizzazione',
      title: `Sotto il riff in power chord: ${power.join(' ')}`,
      description: 'Stesse fondamentali in power chord: la linea resta protagonista e il suono è compatto.',
      chords: power,
      melody: notes,
      beatsPerChord: rock.beatsPerChord,
      score: w.power * 0.8,
    })
  }

  const motif = firstMotifNotes(notes, a)
  const isMotif = motif.length < notes.length
  const dev = (title: string, description: string, melody: MelodyNote[], score: number) =>
    out.push({ kind: 'sviluppo melodico', title, description, melody, score })

  dev('Sequenza ascendente', `${isMotif ? 'Il motivo principale' : 'La frase'} ripetuto salendo di un grado della scala ogni volta: costruisce tensione.`, sequence(motif, pcs, 1), 0.8)
  dev('Domanda e risposta', 'La frase viene ripetuta e la seconda volta atterra sulla tonica: dà una forma compiuta a 2 battute.', answerPhrase(notes, a.key.tonicPc, pcs), 0.85)
  dev('Riff con pedale', `Alterna ogni nota con ${a.key.tonic} grave (corda a vuoto/pedale): classico riff ipnotico.`, pedalize(notes, lowestTonic(a, tuning)), w.pedal)
  dev('Inversione', 'Gli intervalli vengono specchiati: dove saliva scende. Stesso DNA, profilo nuovo.', invertDiatonic(notes, pcs), 0.6)
  dev('Retrogrado', 'La frase al contrario: utile per creare una risposta o un riff di bridge.', retrograde(notes), 0.45)
  const avg = totalBeats(notes) / notes.length
  if (avg <= 0.5) dev('Aumentazione', 'Durate raddoppiate: il riff diventa una melodia lenta, ottima per strofa o voce.', scaleRhythm(notes, 2), 0.6)
  else dev('Diminuzione', 'Durate dimezzate: la melodia diventa un riff più incalzante.', scaleRhythm(notes, 0.5), 0.6)
  dev('Spostamento ritmico', 'Parte mezzo tempo dopo: stesse note, accenti in levare, groove più sincopato.', displace(notes), 0.55)
  dev('Trasposta per il ritornello', 'Stessa linea una terza sopra (in scala): più energia per il ritornello.', transposeDiatonic(notes, 2, pcs), 0.65)

  return out
}
