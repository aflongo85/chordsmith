import { describe, expect, it } from 'vitest'
import { parseChord, parseProgression } from './chords'
import { makeKey } from './key'
import { romanFor, tokenToSymbol } from './roman'
import { analyzeProgression } from './progression'
import { parseMelody, transposeDiatonic, invertDiatonic, formatMelody } from './melody'
import { analyzeMelody } from './melodyAnalysis'
import { altRockProfile } from '../genres/altRock'
import { guitar, bass } from '../instruments'

const std = guitar.tunings[0]
const prog = (s: string) => parseProgression(s).chords

describe('chords', () => {
  it('parses qualities', () => {
    expect(parseChord('E5')?.quality).toBe('power')
    expect(parseChord('Asus2')?.quality).toBe('sus2')
    expect(parseChord('Bm7b5')?.quality).toBe('dim')
    expect(parseChord('C-7')?.symbol).toBe('Cm7')
    expect(parseChord('C/E')?.bass).toBe('E')
    expect(parseChord('Xyz')).toBeNull()
  })
  it('reports bad tokens', () => {
    expect(parseProgression('Am F Qq G').errors).toEqual(['Qq'])
  })
})

describe('roman numerals', () => {
  const C = makeKey(0, 'ionian')
  it('labels chords relative to the major scale', () => {
    expect(romanFor(parseChord('Am7')!, C)).toBe('vi7')
    expect(romanFor(parseChord('Bb')!, C)).toBe('bVII')
    expect(romanFor(parseChord('Bm7b5')!, C)).toBe('viiø7')
    expect(romanFor(parseChord('Fm')!, C)).toBe('iv')
    expect(romanFor(parseChord('Cadd9')!, C)).toBe('Iadd9')
  })
  it('spells chromatic notes the rock way', () => {
    expect(makeKey(4, 'aeolian').names[10]).toBe('Bb')
    expect(makeKey(0, 'ionian').names[10]).toBe('Bb')
    expect(makeKey(0, 'ionian').names[8]).toBe('Ab')
    expect(makeKey(0, 'ionian').names[6]).toBe('F#')
    expect(makeKey(9, 'aeolian').names[8]).toBe('G#')
  })
  it('turns tokens into symbols', () => {
    const D = makeKey(2, 'mixolydian')
    expect(tokenToSymbol('bVII', D)).toBe('C')
    expect(tokenToSymbol('iv7', makeKey(9, 'aeolian'))).toBe('Dm7')
    expect(tokenToSymbol('bVI', makeKey(5, 'ionian'))).toBe('Db')
  })
})

describe('key detection', () => {
  it('hears D C G D as D mixolydian', () => {
    const a = analyzeProgression(prog('D C G D'), altRockProfile)!
    expect(a.key.tonic).toBe('D')
    expect(a.key.mode).toBe('mixolydian')
  })
  it('hears Am F C G as A minor', () => {
    const a = analyzeProgression(prog('Am F C G'), altRockProfile)!
    expect(a.key.tonic).toBe('A')
    expect(a.key.mode).toBe('aeolian')
    expect(a.patterns.map((p) => p.template.name)).toContain('Eolio epico')
  })
  it('hears C G Am F as C major and flags borrowed chords', () => {
    const a = analyzeProgression(prog('C G Am F Fm C'), altRockProfile)!
    expect(a.key.tonic).toBe('C')
    expect(a.items[4].category).toBe('prestito')
  })
  it('labels a secondary dominant', () => {
    const a = analyzeProgression(prog('C A7 Dm G C'), altRockProfile)!
    expect(a.items[1].category).toBe('dominante secondaria')
  })
})

describe('guitar voicings', () => {
  it('finds the open E major shape', () => {
    const v = guitar.voicings(parseChord('E')!, std)
    expect(v.map((x) => x.frets.join(','))).toContain('0,2,2,1,0,0')
  })
  it('finds the open C shape', () => {
    const v = guitar.voicings(parseChord('C')!, std)
    expect(v.map((x) => x.frets.map((f) => f ?? 'x').join(','))).toContain('x,3,2,0,1,0')
  })
  it('makes compact power chords', () => {
    const v = guitar.voicings(parseChord('A5')!, std)
    expect(v[0].midi.length).toBeLessThanOrEqual(3)
    expect(v[0].midi[0] % 12).toBe(9)
  })
  it('bass plays single roots', () => {
    const v = bass.voicings(parseChord('G')!, bass.tunings[0])
    expect(v[0].midi).toHaveLength(1)
    expect(v[0].midi[0] % 12).toBe(7)
  })
})

describe('melody', () => {
  it('parses notes, durations, rests and tab tokens', () => {
    const { notes, errors } = parseMelody('E2 G2/8 r/8 6:5 A', guitar, std)
    expect(errors).toEqual([])
    expect(notes.map((n) => n.midi)).toEqual([40, 43, null, 45, 45])
    expect(notes[1].dur).toBe(0.5)
  })
  it('detects E minor pentatonic riff', () => {
    const { notes } = parseMelody('E2 G2 A2 E2 G2 Bb2 A2 E2 G2 A2 G2 E2', guitar, std)
    const a = analyzeMelody(notes, altRockProfile.modePriors, altRockProfile.melodyScales)!
    expect(a.key.tonic).toBe('E')
    expect(a.scaleFits[0].scale).toBe('blues')
    expect(a.motifs.length).toBeGreaterThan(0)
  })
  it('hears a short blues riff in E even when it ends on A', () => {
    const { notes } = parseMelody('E2/8 G2/8 A2/4 E2/8 G2/8 Bb2/8 A2/4', guitar, std)
    expect(analyzeMelody(notes, altRockProfile.modePriors, altRockProfile.melodyScales)!.key.tonic).toBe('E')
  })
  it('transforms diatonically', () => {
    const C = makeKey(0, 'ionian')
    const { notes } = parseMelody('C4 D4 E4', guitar, std)
    expect(formatMelody(transposeDiatonic(notes, 1, C.scalePcs))).toBe('D4 E4 F4')
    expect(formatMelody(invertDiatonic(notes, C.scalePcs))).toBe('C4 B3 A3')
  })
})
