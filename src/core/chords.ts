import { Chord } from 'tonal'
import { mod12, pcOf } from './notes'
import type { KeyContext } from './key'

export type ChordQuality = 'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'power' | 'other'

export interface ParsedChord {
  symbol: string
  root: string
  rootPc: number
  /** what follows the root, without the slash bass (e.g. "m7", "sus2", "") */
  suffix: string
  bass?: string
  bassPc?: number
  /** pitch classes, root first; includes the bass */
  pcs: number[]
  /** sorted unique semitones above the root */
  intervals: number[]
  quality: ChordQuality
  seventh: 'b7' | 'maj7' | 'dim7' | null
}

function qualityOf(iv: Set<number>): ChordQuality {
  const has = (n: number) => iv.has(n)
  if (has(4) && has(8) && !has(7)) return 'aug'
  if (has(4)) return 'major'
  if (has(3) && has(6) && !has(7)) return 'dim'
  if (has(3)) return 'minor'
  if (has(2) && has(7)) return 'sus2'
  if (has(5) && has(7)) return 'sus4'
  if (has(7) && iv.size <= 2) return 'power'
  return 'other'
}

function normalise(symbol: string): string {
  return symbol
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/^([a-g])/, (m) => m.toUpperCase())
    .replace(/^([A-G][#b]?)-(?=\d|$)/, '$1m') // C-7 → Cm7
}

export function parseChord(input: string): ParsedChord | null {
  const symbol = normalise(input)
  if (!symbol) return null
  const c = Chord.get(symbol)
  if (c.empty || !c.tonic) return null
  const rootPc = pcOf(c.tonic)
  if (rootPc === null) return null
  const bass = c.bass || undefined
  const bassPc = bass ? (pcOf(bass) ?? undefined) : undefined
  const notePcs = c.notes.map((n) => pcOf(n)).filter((p): p is number => p !== null)
  const iv = new Set(notePcs.map((p) => mod12(p - rootPc)))
  const pcs = [...new Set([rootPc, ...notePcs, ...(bassPc !== undefined ? [bassPc] : [])])]
  const main = bass ? symbol.slice(0, symbol.lastIndexOf('/')) : symbol
  const seventh = iv.has(10) ? 'b7' : iv.has(11) ? 'maj7' : iv.has(9) && iv.has(6) && iv.has(3) ? 'dim7' : null
  return {
    symbol,
    root: c.tonic,
    rootPc,
    suffix: main.slice(c.tonic.length),
    bass,
    bassPc,
    pcs,
    intervals: [...iv].sort((a, b) => a - b),
    quality: qualityOf(iv),
    seventh,
  }
}

/** Splits free text ("Am F | C G", "Am, F, C, G") into chord tokens. */
export function tokenizeProgression(text: string): string[] {
  return text
    .split(/[\s,|;]+/)
    .map((t) => t.trim())
    .filter((t) => t && t !== '-' && t !== '%')
}

export function parseProgression(text: string): { chords: ParsedChord[]; errors: string[] } {
  const chords: ParsedChord[] = []
  const errors: string[] = []
  for (const tok of tokenizeProgression(text)) {
    const c = parseChord(tok)
    if (c) chords.push(c)
    else errors.push(tok)
  }
  return { chords, errors }
}

/** Builds a chord symbol from a root pc + suffix, spelled for the given key. */
export function chordSymbol(rootPc: number, suffix: string, key: KeyContext, bassPc?: number): string {
  const root = key.names[mod12(rootPc)]
  const bass = bassPc !== undefined && mod12(bassPc) !== mod12(rootPc) ? `/${key.names[mod12(bassPc)]}` : ''
  return `${root}${suffix}${bass}`
}

export function transposeChord(chord: ParsedChord, semitones: number, key: KeyContext): string {
  return chordSymbol(
    chord.rootPc + semitones,
    chord.suffix,
    key,
    chord.bassPc !== undefined ? chord.bassPc + semitones : undefined,
  )
}

/** Suffix for a plain triad of the given quality. */
export function triadSuffix(q: ChordQuality): string {
  switch (q) {
    case 'minor':
      return 'm'
    case 'dim':
      return 'dim'
    case 'aug':
      return 'aug'
    case 'sus2':
      return 'sus2'
    case 'sus4':
      return 'sus4'
    case 'power':
      return '5'
    default:
      return ''
  }
}
