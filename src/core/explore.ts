import { parseChord, type ParsedChord } from './chords'
import { diatonicTriads } from './harmony'
import { makeKey, type KeyContext } from './key'
import { mod12 } from './notes'
import { analyzeChord, type ChordCategory, type HarmonicFunction } from './progression'
import { romanFor, tokenFor, tokenToSymbol } from './roman'
import { MODE_IDS, SCALES, type ModeId } from './scales'
import type { GenreProfile, ProgressionTemplate } from '../genres/types'

export interface ExploreChord {
  symbol: string
  chord: ParsedChord
  roman: string
  func: HarmonicFunction
  category: ChordCategory
  /** short hint: where it comes from or where it leads */
  hint: string
  /** idiomatic in the current genre */
  common: boolean
}

export interface BorrowGroup {
  mode: ModeId
  label: string
  color: string
  chords: ExploreChord[]
}

export interface ExploreProgression {
  template: ProgressionTemplate
  chords: ExploreChord[]
  borrowed: number
}

export interface KeyExploration {
  key: KeyContext
  diatonic: ExploreChord[]
  borrowed: BorrowGroup[]
  secondary: ExploreChord[]
  progressions: ExploreProgression[]
}

/** What each parallel mode brings, in a few words. */
export const MODE_COLOR: Record<ModeId, string> = {
  ionian: 'maggiore: luminoso e risolto',
  dorian: 'minore con il IV maggiore: più luminoso',
  phrygian: 'minore con il ♭II: scuro, pesante',
  lydian: 'maggiore con il II maggiore: sognante, sospeso',
  mixolydian: 'maggiore con il ♭VII: rock, aperto',
  aeolian: 'minore naturale: malinconico, epico',
  locrian: 'instabile',
}

const sig = (c: ParsedChord) => [...new Set(c.pcs)].sort((a, b) => a - b).join(',')

function item(symbol: string, key: KeyContext, genre: GenreProfile, hint: string, category?: ChordCategory): ExploreChord | null {
  const chord = parseChord(symbol)
  if (!chord) return null
  const a = analyzeChord(chord, key)
  return {
    symbol: chord.symbol,
    chord,
    roman: romanFor(chord, key),
    func: category === 'dominante secondaria' ? 'dominante' : a.func,
    category: category ?? a.category,
    hint,
    common: genre.borrowedPalette.includes(tokenFor(chord, key)),
  }
}

/**
 * Everything you can reach from a key: its own chords, the chords borrowed from the
 * parallel modes (same tonic), the secondary dominants and the genre's progressions
 * realised in that key.
 */
export function exploreKey(key: KeyContext, genre: GenreProfile): KeyExploration {
  const triads = diatonicTriads(key)
  const seen = new Set(triads.map((t) => sig(t.chord)))

  const diatonic = triads.flatMap((t) => {
    const it = item(t.symbol, key, genre, '')
    return it ? [{ ...it, common: false }] : []
  })

  // parallel modes, closest first (fewest changed notes), then the genre's favourites
  const distance = (m: ModeId) => SCALES[m].intervals.filter((iv) => !SCALES[key.mode].intervals.includes(iv)).length
  const modes = MODE_IDS.filter((m) => m !== key.mode && m !== 'locrian').sort(
    (a, b) => distance(a) - distance(b) || (genre.modePriors[b] ?? 0) - (genre.modePriors[a] ?? 0),
  )
  const borrowed = modes.flatMap((mode): BorrowGroup[] => {
    const parallel = makeKey(key.tonicPc, mode)
    const chords = diatonicTriads(parallel).flatMap((t) => {
      const s = sig(t.chord)
      if (seen.has(s) || t.chord.quality === 'dim') return []
      seen.add(s)
      const it = item(t.symbol, key, genre, `dal ${SCALES[mode].label}`, 'prestito')
      return it ? [it] : []
    })
    return chords.length ? [{ mode, label: parallel.label, color: MODE_COLOR[mode], chords }] : []
  })

  // V7 of every diatonic chord except the tonic, unless it is already in the key
  const secondary = diatonic.flatMap((target) => {
    const c = target.chord
    if (c.rootPc === key.tonicPc || c.quality === 'dim' || c.quality === 'aug') return []
    const root = mod12(c.rootPc + 7)
    // spell it as the dominant of its target (G#7 → Am, not Ab7)
    const targetKey = makeKey(c.rootPc, c.quality === 'minor' ? 'aeolian' : 'ionian')
    const dom = parseChord(targetKey.names[root] + '7')
    if (!dom || dom.pcs.every((pc) => key.scalePcs.includes(pc))) return []
    const it = item(dom.symbol, key, genre, `porta a ${target.symbol}`, 'dominante secondaria')
    return it ? [{ ...it, roman: `V7/${target.roman}`, common: false }] : []
  })

  const progressions = genre.templates
    .flatMap((template): ExploreProgression[] => {
      const chords = template.romans.flatMap((tok) => {
        const s = spellToken(tok, key, modes)
        const it = s ? item(s, key, genre, '') : null
        return it ? [it] : []
      })
      if (chords.length !== template.romans.length) return []
      return [{ template, chords, borrowed: chords.filter((c) => c.category !== 'diatonico').length }]
    })
    .sort((a, b) => a.borrowed - b.borrowed)

  return { key, diatonic, borrowed, secondary, progressions }
}

/** Spell a borrowed chord the way its parallel mode does (C#m in E minor, not Dbm). */
function spellToken(token: string, key: KeyContext, modes: ModeId[]): string | null {
  const s = tokenToSymbol(token, key)
  const chord = s ? parseChord(s) : null
  if (!chord || chord.pcs.every((pc) => key.scalePcs.includes(pc))) return s
  for (const mode of modes) {
    const parallel = makeKey(key.tonicPc, mode)
    if (chord.pcs.every((pc) => parallel.scalePcs.includes(pc))) return tokenToSymbol(token, parallel)
  }
  // chromatic: a natural numeral is spelled from the major key, a flat one from the minor
  return tokenToSymbol(token, makeKey(key.tonicPc, token.startsWith('b') ? 'aeolian' : 'ionian'))
}
