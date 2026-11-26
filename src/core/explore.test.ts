import { describe, expect, it } from 'vitest'
import { exploreKey } from './explore'
import { makeKey } from './key'
import { altRockProfile } from '../genres/altRock'

const symbols = (cs: { symbol: string }[]) => cs.map((c) => c.symbol)

describe('key explorer', () => {
  it('lists diatonic, borrowed and secondary chords of C major', () => {
    const x = exploreKey(makeKey(0, 'ionian'), altRockProfile)
    expect(symbols(x.diatonic)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])
    const borrowed = x.borrowed.flatMap((g) => symbols(g.chords))
    for (const c of ['Bb', 'Ab', 'Fm', 'Eb', 'Cm']) expect(borrowed).toContain(c)
    expect(new Set(borrowed).size).toBe(borrowed.length)
    expect(symbols(x.secondary)).toEqual(expect.arrayContaining(['A7', 'B7', 'C7', 'D7', 'E7']))
    expect(symbols(x.secondary)).not.toContain('G7')
    expect(x.borrowed.flatMap((g) => g.chords).find((c) => c.symbol === 'Bb')?.common).toBe(true)
  })
  it('borrows the dorian IV in E minor and realises the genre templates', () => {
    const x = exploreKey(makeKey(4, 'aeolian'), altRockProfile)
    const dorian = x.borrowed.find((g) => g.mode === 'dorian')
    expect(symbols(dorian?.chords ?? [])).toContain('A')
    const epic = x.progressions.find((p) => p.template.name === 'Eolio epico')
    expect(symbols(epic?.chords ?? [])).toEqual(['Em', 'C', 'G', 'D'])
    expect(epic?.borrowed).toBe(0)
    expect(x.secondary.map((c) => c.symbol)).not.toContain('D7')
  })
})

describe('key explorer spelling', () => {
  it('spells borrowed chords with sharps where the parallel mode does', () => {
    const x = exploreKey(makeKey(4, 'aeolian'), altRockProfile)
    const anthem = x.progressions.find((p) => p.template.name === 'Inno anthemico')
    expect(symbols(anthem?.chords ?? [])).toEqual(['C#m', 'A', 'E', 'B'])
    const mediant = x.progressions.find((p) => p.template.name === 'Mediante maggiore e iv')
    expect(symbols(mediant?.chords ?? [])).toEqual(['E', 'G#', 'A', 'Am'])
  })
})
