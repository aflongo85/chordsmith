import { Note } from 'tonal'

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const SOLFEGE: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' }

export const mod12 = (n: number): number => ((n % 12) + 12) % 12

/** Pitch class (0-11) of a note name, or null if it's not a valid note. */
export function pcOf(note: string): number | null {
  const c = Note.chroma(note)
  return typeof c === 'number' && !Number.isNaN(c) ? c : null
}

/** MIDI number of a note with octave (e.g. "E2" → 40), or null. */
export function midiOf(note: string): number | null {
  const m = Note.midi(note)
  return typeof m === 'number' ? m : null
}

export function isNoteName(s: string): boolean {
  return !Note.get(s).empty
}

export function midiToName(midi: number, names: readonly string[] = SHARP_NAMES): string {
  return names[mod12(midi)] + String(Math.floor(midi / 12) - 1)
}

/** "F#" → "Fa♯" — used for human-readable key labels. */
export function toSolfege(name: string): string {
  const letter = name[0]?.toUpperCase() ?? ''
  const acc = name.slice(1).replace(/#/g, '♯').replace(/b/g, '♭')
  return (SOLFEGE[letter] ?? letter) + acc
}

const CHORD_TAIL = String.raw`(?=$|[\s\d/)\],.:;'"’m+°ø-]|maj|add|aug|sus|dim)`
const NOTE_FLAT = new RegExp(String.raw`(?<=\b[A-G])b` + CHORD_TAIL, 'g')
const NOTE_SHARP = new RegExp(String.raw`(?<=\b[A-G])#`, 'g')
const ROMAN_ACC = /(^|[^A-Za-z])([b#])(?=(?:VII|VI|IV|V|III|II|I)|(?:vii|vi|iv|v|iii|ii|i)(?![a-z]))/g

/** Typographic ♭/♯ for note names ("Bbm" → "B♭m") and roman numerals ("bVII" → "♭VII"), leaving prose alone. */
export function prettyAccidentals(s: string): string {
  return s
    .replace(NOTE_SHARP, '♯')
    .replace(NOTE_FLAT, '♭')
    .replace(ROMAN_ACC, (_m, pre: string, acc: string) => pre + (acc === 'b' ? '♭' : '♯'))
}
