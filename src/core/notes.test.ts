import { expect, it } from 'vitest'
import { prettyAccidentals as P } from './notes'

it('prettifies chords and numerals but not Italian prose', () => {
  expect(P('Bbm7 Ebmaj7 F#5 Ab/C')).toBe('B♭m7 E♭maj7 F♯5 A♭/C')
  expect(P('bVII al posto di V, bIII e iv, V/bVI')).toBe('♭VII al posto di V, ♭III e iv, V/♭VI')
  expect(P('bilancia con qualche Ebbene')).toBe('bilancia con qualche Ebbene')
})
