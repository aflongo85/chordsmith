import { mod12 } from './notes'
import type { KeyContext } from './key'
import { parseChord, type ParsedChord } from './chords'
import { tokenFor, tokenToSymbol } from './roman'

export interface CandidateChord {
  symbol: string
  chord: ParsedChord
  token: string
  diatonic: boolean
}

function triadSuffix(root: number, third: number, fifth: number): string {
  const t = mod12(third - root)
  const f = mod12(fifth - root)
  if (t === 4 && f === 8) return 'aug'
  if (t === 3 && f === 6) return 'dim'
  return t === 3 ? 'm' : ''
}

/** The seven triads built on the degrees of the key's mode. */
export function diatonicTriads(key: KeyContext): CandidateChord[] {
  const s = key.scalePcs
  return s.flatMap((root, i) => {
    const symbol = key.names[root] + triadSuffix(root, s[(i + 2) % s.length], s[(i + 4) % s.length])
    const chord = parseChord(symbol)
    return chord ? [{ symbol, chord, token: tokenFor(chord, key), diatonic: true }] : []
  })
}

/** Diatonic triads plus the chords a genre likes to borrow. */
export function candidateChords(key: KeyContext, borrowedTokens: string[]): CandidateChord[] {
  const out = diatonicTriads(key)
  const have = new Set(out.map((c) => c.chord.pcs.slice().sort().join(',')))
  for (const tok of borrowedTokens) {
    const symbol = tokenToSymbol(tok, key)
    const chord = symbol ? parseChord(symbol) : null
    if (!chord || !symbol) continue
    const sig = chord.pcs.slice().sort().join(',')
    if (have.has(sig)) continue
    have.add(sig)
    out.push({ symbol, chord, token: tokenFor(chord, key), diatonic: false })
  }
  return out
}
