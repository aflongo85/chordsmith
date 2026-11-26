import { StringedInstrument } from './stringed'
import type { Instrument, Tuning } from './types'

const t = (id: string, name: string, strings: number[], offset = 0): Tuning => ({ id, name, strings, offset })

const GUITAR_STANDARD = [40, 45, 50, 55, 59, 64]
const GUITAR_DROP_D = [38, 45, 50, 55, 59, 64]
const BASS_STANDARD = [28, 33, 38, 43]

export const guitar = new StringedInstrument({
  id: 'guitar',
  name: 'Chitarra',
  polyphonic: true,
  frets: 15,
  defaultOctave: 3,
  tunings: [
    t('standard', 'Standard (E A D G B E)', GUITAR_STANDARD),
    t('drop-d', 'Drop D (D A D G B E)', GUITAR_DROP_D),
    // transposed tunings: same shapes as the reference tuning, sounding lower
    t('eb', 'Mezzo tono sotto (forme standard)', GUITAR_STANDARD, -1),
    t('d-std', 'Un tono sotto (forme standard)', GUITAR_STANDARD, -2),
    t('drop-c#', 'Drop C# (forme Drop D)', GUITAR_DROP_D, -1),
    t('drop-c', 'Drop C (forme Drop D)', GUITAR_DROP_D, -2),
    t('dadgad', 'DADGAD', [38, 45, 50, 55, 57, 62]),
    t('open-d', 'Open D (D A D F# A D)', [38, 45, 50, 54, 57, 62]),
  ],
})

export const bass = new StringedInstrument({
  id: 'bass',
  name: 'Basso',
  polyphonic: false,
  frets: 15,
  defaultOctave: 2,
  tunings: [
    t('standard', 'Standard (E A D G)', BASS_STANDARD),
    t('drop-d', 'Drop D (D A D G)', [26, 33, 38, 43]),
    t('eb', 'Mezzo tono sotto (forme standard)', BASS_STANDARD, -1),
    t('d-std', 'Un tono sotto (forme standard)', BASS_STANDARD, -2),
  ],
})

/** Register new instruments here (e.g. a keyboard implementation of Instrument). */
export const INSTRUMENTS: Instrument[] = [guitar, bass]

export function getInstrument(id: string): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]
}

export function getTuning(instrument: Instrument, id: string): Tuning {
  return instrument.tunings.find((t) => t.id === id) ?? instrument.tunings[0]
}

export type { Instrument, Tuning, Voicing, Position } from './types'
