import { describe, expect, it } from 'vitest'
import { parseProgression } from '../core/chords'
import { parseMelody } from '../core/melody'
import { analyzeMelody } from '../core/melodyAnalysis'
import { analyzeProgression } from '../core/progression'
import { altRockProfile } from '../genres/altRock'
import { guitar } from '../instruments'
import { harmonize } from './melodyRules'
import { collectSuggestions } from '.'
import { createLlmProvider } from './llm'

const tuning = guitar.tunings[0]
const ctxFor = (prog: string, mel = '') => {
  const chords = parseProgression(prog).chords
  const notes = parseMelody(mel, guitar, tuning).notes
  return {
    genre: altRockProfile,
    instrument: guitar,
    tuning,
    progression: analyzeProgression(chords, altRockProfile),
    melody: analyzeMelody(notes, altRockProfile.modePriors, altRockProfile.melodyScales),
    melodyNotes: notes,
  }
}

describe('rule suggestions', () => {
  it('suggests next chords and valid progressions', async () => {
    const s = await collectSuggestions(ctxFor('C G Am F'))
    const kinds = new Set(s.map((x) => x.kind))
    expect(kinds).toContain('prossimo accordo')
    expect(kinds).toContain('sostituzione')
    expect(kinds).toContain('variazione')
    expect(kinds).toContain('nuova sezione')
    for (const x of s) for (const c of x.chords ?? []) expect(parseProgression(c).errors).toEqual([])
    expect(s.some((x) => x.title.includes('bVII al posto di V'))).toBe(true)
  })

  it('suggests melody developments and harmonizations', async () => {
    const s = await collectSuggestions(ctxFor('', 'E2/8 G2/8 A2/4 E2/8 G2/8 Bb2/8 A2/4 E2/8 G2/8 A2/4 G2/8 E2/2'))
    expect(s.filter((x) => x.kind === 'sviluppo melodico').length).toBeGreaterThan(4)
    expect(s.some((x) => x.kind === 'armonizzazione')).toBe(true)
  })

  it('harmonizes a C major melody with fitting chords', () => {
    const { notes } = parseMelody('C4 E4 G4 E4 F4 A4 C5 A4 G4 B4 D5 B4 C5/1', guitar, tuning)
    const a = analyzeMelody(notes, undefined, ['ionian'])!
    const h = harmonize(notes, a.key, altRockProfile, false)
    expect(h.chords[0]).toBe('C')
    expect(h.chords[1]).toBe('F')
    expect(h.chords[2]).toBe('G')
  })
})

describe('llm provider', () => {
  it('validates model output', async () => {
    const provider = createLlmProvider({
      complete: async () =>
        'Ecco: [{"kind":"variazione","title":"Prova","description":"x","chords":["Am","Nope","F"],"melody":"E2 G2/8"},{"bad":1}]',
    })
    const s = await provider.suggest(ctxFor('Am F C G'))
    expect(s).toHaveLength(1)
    expect(s[0].chords).toEqual(['Am', 'F'])
    expect(s[0].melody).toHaveLength(2)
  })
})
