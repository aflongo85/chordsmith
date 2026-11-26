import { StringedInstrument } from './stringed'
import type { Instrument, Tuning } from './types'

const t = (id: string, name: string, strings: number[]): Tuning => ({ id, name, strings })

export const guitar = new StringedInstrument({
  id: 'guitar',
  name: 'Chitarra',
  polyphonic: true,
  frets: 15,
  defaultOctave: 3,
  tunings: [
    t('standard', 'Standard (E A D G B E)', [40, 45, 50, 55, 59, 64]),
    t('drop-d', 'Drop D (D A D G B E)', [38, 45, 50, 55, 59, 64]),
    t('eb', 'Mezzo tono sotto (Eb)', [39, 44, 49, 54, 58, 63]),
    t('drop-c', 'Drop C (C G C F A D)', [36, 43, 48, 53, 57, 62]),
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
    t('standard', 'Standard (E A D G)', [28, 33, 38, 43]),
    t('drop-d', 'Drop D (D A D G)', [26, 33, 38, 43]),
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
