import { mod12 } from './notes'
import type { KeyContext } from './key'
import type { ChordQuality, ParsedChord } from './chords'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
/** semitones above tonic → [accidental, numeral index], relative to the major scale (rock/pop convention). */
const DEGREE_MAP: [string, number][] = [
  ['', 0], ['b', 1], ['', 1], ['b', 2], ['', 2], ['', 3],
  ['#', 3], ['', 4], ['b', 5], ['', 5], ['b', 6], ['', 6],
]

export function degreeOf(rootPc: number, key: KeyContext): number {
  return mod12(rootPc - key.tonicPc)
}

function numeral(degree: number, lower: boolean): string {
  const [acc, idx] = DEGREE_MAP[mod12(degree)]
  const n = NUMERALS[idx]
  return acc + (lower ? n.toLowerCase() : n)
}

function extension(chord: ParsedChord): string {
  const iv = new Set(chord.intervals)
  switch (chord.quality) {
    case 'dim':
      return chord.seventh === 'dim7' ? '°7' : chord.seventh === 'b7' ? 'ø7' : '°'
    case 'aug':
      return '+' + (chord.seventh === 'b7' ? '7' : '')
    case 'power':
      return '5'
    case 'sus2':
    case 'sus4':
      return (chord.seventh === 'b7' ? '7' : '') + chord.quality
    default: {
      const has9 = iv.has(2)
      if (chord.seventh === 'b7') return has9 ? '9' : '7'
      if (chord.seventh === 'maj7') return has9 ? 'maj9' : 'maj7'
      if (has9) return 'add9'
      if (iv.has(9)) return '6'
      return ''
    }
  }
}

function isLower(q: ChordQuality): boolean {
  return q === 'minor' || q === 'dim'
}

/** Full roman numeral, e.g. "bVII", "vi7", "viiø7", "Isus2", "IV/A". */
export function romanFor(chord: ParsedChord, key: KeyContext): string {
  const base = numeral(degreeOf(chord.rootPc, key), isLower(chord.quality))
  const bass = chord.bassPc !== undefined && chord.bassPc !== chord.rootPc ? `/${key.names[chord.bassPc]}` : ''
  return base + extension(chord) + bass
}

/** Short token used for matching templates and transitions, e.g. "bVII", "iv", "vii°". */
export function tokenFor(chord: ParsedChord, key: KeyContext): string {
  const base = numeral(degreeOf(chord.rootPc, key), isLower(chord.quality))
  if (chord.quality === 'dim') return base + '°'
  if (chord.quality === 'aug') return base + '+'
  return base
}

export interface RomanToken {
  degree: number
  quality: 'major' | 'minor' | 'dim' | 'aug'
  suffix: string
}

const TOKEN_RE = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|\+)?(.*)$/

export function parseToken(token: string): RomanToken | null {
  const m = TOKEN_RE.exec(token.trim())
  if (!m) return null
  const [, acc, num, mark, suffix] = m
  const idx = NUMERALS.indexOf(num.toUpperCase())
  const lower = num === num.toLowerCase()
  const degree = mod12(MAJOR_STEPS[idx] + (acc === 'b' ? -1 : acc === '#' ? 1 : 0))
  const quality = mark === '°' ? 'dim' : mark === '+' ? 'aug' : lower ? 'minor' : 'major'
  return { degree, quality, suffix }
}

/** "bVII" in D → "C", "iv7" in A → "Dm7", "V5" in E → "B5". */
export function tokenToSymbol(token: string, key: KeyContext): string | null {
  const t = parseToken(token)
  if (!t) return null
  const root = key.names[mod12(key.tonicPc + t.degree)]
  const s = t.suffix
  if (/^(5|sus2|sus4|7sus4)$/.test(s)) return root + s
  switch (t.quality) {
    case 'minor':
      return root + 'm' + s
    case 'dim':
      return root + (s === '7' ? 'dim7' : s === 'ø7' ? 'm7b5' : 'dim')
    case 'aug':
      return root + 'aug'
    default:
      return root + s
  }
}

/** Does the chord fit the template token (ambiguous chords such as power chords match either case)? */
export function tokenMatches(chord: ParsedChord, key: KeyContext, token: string): boolean {
  const t = parseToken(token)
  if (!t || t.degree !== degreeOf(chord.rootPc, key)) return false
  switch (chord.quality) {
    case 'major':
      return t.quality === 'major'
    case 'minor':
      return t.quality === 'minor'
    case 'dim':
      return t.quality === 'dim'
    case 'aug':
      return t.quality === 'aug'
    default:
      return t.quality === 'major' || t.quality === 'minor'
  }
}
