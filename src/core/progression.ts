import { mod12, prettyAccidentals } from './notes'
import { type KeyCandidate, type KeyContext, type ModePriors, makeKey, priorFor, rankCandidates, scalePcs } from './key'
import { MODE_IDS, MODE_TONIC_QUALITY, SCALES, type ModeId, type ScaleId } from './scales'
import type { ParsedChord } from './chords'
import { degreeOf, romanFor, tokenFor, tokenMatches } from './roman'
import type { GenreProfile, ProgressionTemplate } from '../genres/types'

export type HarmonicFunction = 'tonica' | 'sottodominante' | 'dominante' | 'cromatico'
export type ChordCategory = 'diatonico' | 'prestito' | 'dominante secondaria' | 'cromatico'

export interface ChordAnalysis {
  chord: ParsedChord
  roman: string
  token: string
  degree: number
  func: HarmonicFunction
  category: ChordCategory
  borrowedFrom?: ScaleId
  note: string
}

export interface PatternMatch {
  template: ProgressionTemplate
  start: number
}

export interface ProgressionAnalysis {
  chords: ParsedChord[]
  items: ChordAnalysis[]
  key: KeyContext
  candidates: KeyCandidate[]
  patterns: PatternMatch[]
  observations: string[]
}

// ---------------------------------------------------------------- key detection

function tonicFits(chord: ParsedChord, mode: ModeId): boolean {
  const q = MODE_TONIC_QUALITY[mode]
  if (chord.quality === 'power' || chord.quality === 'sus2' || chord.quality === 'sus4') return q !== 'dim'
  return chord.quality === q
}

export function detectKeyFromChords(chords: ParsedChord[], priors?: ModePriors): KeyCandidate[] {
  if (chords.length === 0) return []
  const raw: { tonicPc: number; mode: ModeId; score: number }[] = []
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of MODE_IDS) {
      const scale = new Set(scalePcs(tonic, mode))
      let score = 0
      chords.forEach((c, i) => {
        const inside = c.pcs.filter((p) => scale.has(p)).length
        if (inside === c.pcs.length) score += 2
        else if (scale.has(c.rootPc)) score += 0.5 + inside / c.pcs.length / 2
        else score -= 0.5
        if (c.rootPc === tonic && tonicFits(c, mode)) {
          score += 0.6
          if (i === 0) score += 1.5
          if (i === chords.length - 1) score += 1.2
        }
      })
      score += priorFor(mode, priors) * 2
      raw.push({ tonicPc: tonic, mode, score })
    }
  }
  return rankCandidates(raw)
}

// ---------------------------------------------------------------- per-chord analysis

const FUNCTION_BY_DEGREE: Record<number, HarmonicFunction> = {
  0: 'tonica', 3: 'tonica', 4: 'tonica', 9: 'tonica',
  2: 'sottodominante', 5: 'sottodominante', 8: 'sottodominante', 1: 'sottodominante',
  7: 'dominante', 11: 'dominante', 10: 'dominante', 6: 'cromatico',
}

const COMMON_BORROWINGS = new Set(['bVII', 'bVI', 'bIII', 'bII', 'iv', 'v', 'i', 'I'])

const BORROW_ORDER: ScaleId[] = ['aeolian', 'ionian', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonicMinor']

function fitsScale(chord: ParsedChord, pcs: number[]): boolean {
  const s = new Set(pcs)
  return chord.pcs.every((p) => s.has(p))
}

function describe(item: Omit<ChordAnalysis, 'note'>, key: KeyContext, next?: ParsedChord): string {
  const r = prettyAccidentals(item.roman)
  switch (item.category) {
    case 'diatonico':
      return `${r}: accordo diatonico con funzione di ${item.func}.`
    case 'prestito': {
      const from = item.borrowedFrom ? SCALES[item.borrowedFrom].label : 'un modo parallelo'
      return `${r}: preso in prestito dal ${from} di ${key.tonic} (interscambio modale).`
    }
    case 'dominante secondaria':
      return `${r}: dominante secondaria che spinge verso ${next?.symbol ?? 'l\'accordo successivo'}.`
    default:
      if ([3, 4, 8, 9].includes(item.degree)) return `${r}: mediante cromatica, cambio di colore improvviso.`
      return `${r}: accordo cromatico, fuori dalla tonalità.`
  }
}

export function analyzeChord(chord: ParsedChord, key: KeyContext, next?: ParsedChord): ChordAnalysis {
  const degree = degreeOf(chord.rootPc, key)
  let category: ChordCategory = 'cromatico'
  let borrowedFrom: ScaleId | undefined
  const token = tokenFor(chord, key)
  if (fitsScale(chord, key.scalePcs)) category = 'diatonico'
  else {
    const looksSecondary =
      next !== undefined &&
      (chord.quality === 'major' || chord.seventh === 'b7') &&
      mod12(next.rootPc - chord.rootPc) === 5 &&
      degreeOf(next.rootPc, key) !== 0 &&
      // flat-side chords are far more often modal borrowings than applied dominants
      !COMMON_BORROWINGS.has(token)
    if (looksSecondary) category = 'dominante secondaria'
    else {
      borrowedFrom = BORROW_ORDER.filter((s) => s !== key.mode).find((s) => fitsScale(chord, scalePcs(key.tonicPc, s)))
      if (borrowedFrom) category = 'prestito'
    }
  }
  const base = {
    chord,
    roman: romanFor(chord, key),
    token,
    degree,
    func: category === 'dominante secondaria' ? 'dominante' : FUNCTION_BY_DEGREE[degree],
    category,
    borrowedFrom,
  } satisfies Omit<ChordAnalysis, 'note'>
  return { ...base, note: describe(base, key, next) }
}

// ---------------------------------------------------------------- patterns & observations

export function findPatterns(chords: ParsedChord[], key: KeyContext, templates: ProgressionTemplate[]): PatternMatch[] {
  const n = chords.length
  const found: PatternMatch[] = []
  for (const template of templates) {
    const len = template.romans.length
    if (len > n) continue
    // treat the progression as a loop so rotations still match
    for (let start = 0; start < n; start++) {
      if (start + len > n && n < 4) break
      const ok = template.romans.every((tok, j) => tokenMatches(chords[(start + j) % n], key, tok))
      if (ok) {
        found.push({ template, start })
        break
      }
    }
  }
  return found
}

function observations(items: ChordAnalysis[], key: KeyContext): string[] {
  const out: string[] = []
  const tokens = items.map((i) => i.token)
  const borrowed = items.filter((i) => i.category === 'prestito')
  const hasMajorV = items.some((i) => i.degree === 7 && (i.chord.quality === 'major' || i.chord.seventh === 'b7'))
  const hasbVII = tokens.includes('bVII')
  if (borrowed.length) {
    const list = [...new Set(borrowed.map((b) => prettyAccidentals(b.token)))].join(', ')
    out.push(`Interscambio modale: ${list}. È uno dei colori principali del rock.`)
  }
  if (hasbVII && !hasMajorV) out.push('Usi bVII senza la dominante V: sapore modale e "aperto", tipico del rock.')
  if (!hasMajorV && !hasbVII && items.length >= 3)
    out.push('Non c\'è una dominante forte: la progressione gira in modo circolare, più modale che tonale.')
  const powers = items.filter((i) => i.chord.quality === 'power').length
  if (powers && powers === items.length)
    out.push('Solo power chord: terze assenti, quindi maggiore/minore lo decide la melodia (o il basso).')
  if (items.length >= 2) {
    const a = items[items.length - 2]
    const b = items[items.length - 1]
    if (b.degree === 0) {
      if (a.degree === 7) out.push('Chiude con una cadenza V→I (autentica): risoluzione forte, conclusiva.')
      else if (a.degree === 5) out.push('Chiude con IV→I (plagale): risoluzione morbida, "amen".')
      else if (a.degree === 10) out.push('Chiude con bVII→I: la cadenza "rock/misolidia".')
      else if (a.degree === 8) out.push('Chiude con bVI→I: arrivo epico tramite prestito eolio.')
    } else if (b.degree === 7) {
      out.push('Finisce sulla dominante: semicadenza, la frase resta sospesa e chiama un seguito.')
    }
  }
  const modeLabel = SCALES[key.mode].label
  if (key.mode !== 'ionian' && key.mode !== 'aeolian')
    out.push(`Il centro tonale suona ${modeLabel}: sfrutta le note caratteristiche di questo modo nella melodia.`)
  return out
}

export function analyzeProgression(
  chords: ParsedChord[],
  genre: GenreProfile,
  keyOverride?: { tonicPc: number; mode: ModeId },
): ProgressionAnalysis | null {
  if (chords.length === 0) return null
  const candidates = detectKeyFromChords(chords, genre.modePriors)
  const key = keyOverride ? makeKey(keyOverride.tonicPc, keyOverride.mode) : candidates[0].key
  const items = chords.map((c, i) => analyzeChord(c, key, chords[i + 1]))
  return {
    chords,
    items,
    key,
    candidates,
    patterns: findPatterns(chords, key, genre.templates),
    observations: observations(items, key),
  }
}
