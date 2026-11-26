export type ModeId = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
export type ScaleId = ModeId | 'majorPent' | 'minorPent' | 'blues' | 'harmonicMinor'

export interface ScaleDef {
  id: ScaleId
  label: string
  /** semitones from tonic */
  intervals: number[]
  /** name understood by tonal's Scale.get, used for spelling */
  tonalName: string
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  ionian: { id: 'ionian', label: 'maggiore (ionio)', intervals: [0, 2, 4, 5, 7, 9, 11], tonalName: 'major' },
  dorian: { id: 'dorian', label: 'dorico', intervals: [0, 2, 3, 5, 7, 9, 10], tonalName: 'dorian' },
  phrygian: { id: 'phrygian', label: 'frigio', intervals: [0, 1, 3, 5, 7, 8, 10], tonalName: 'phrygian' },
  lydian: { id: 'lydian', label: 'lidio', intervals: [0, 2, 4, 6, 7, 9, 11], tonalName: 'lydian' },
  mixolydian: { id: 'mixolydian', label: 'misolidio', intervals: [0, 2, 4, 5, 7, 9, 10], tonalName: 'mixolydian' },
  aeolian: { id: 'aeolian', label: 'minore (eolio)', intervals: [0, 2, 3, 5, 7, 8, 10], tonalName: 'aeolian' },
  locrian: { id: 'locrian', label: 'locrio', intervals: [0, 1, 3, 5, 6, 8, 10], tonalName: 'locrian' },
  majorPent: { id: 'majorPent', label: 'pentatonica maggiore', intervals: [0, 2, 4, 7, 9], tonalName: 'major pentatonic' },
  minorPent: { id: 'minorPent', label: 'pentatonica minore', intervals: [0, 3, 5, 7, 10], tonalName: 'minor pentatonic' },
  blues: { id: 'blues', label: 'blues', intervals: [0, 3, 5, 6, 7, 10], tonalName: 'blues' },
  harmonicMinor: { id: 'harmonicMinor', label: 'minore armonica', intervals: [0, 2, 3, 5, 7, 8, 11], tonalName: 'harmonic minor' },
}

export const MODE_IDS: ModeId[] = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']

/** Quality of the triad built on the tonic of each mode. */
export const MODE_TONIC_QUALITY: Record<ModeId, 'major' | 'minor' | 'dim'> = {
  ionian: 'major',
  dorian: 'minor',
  phrygian: 'minor',
  lydian: 'major',
  mixolydian: 'major',
  aeolian: 'minor',
  locrian: 'dim',
}
