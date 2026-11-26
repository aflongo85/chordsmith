import type { GenreProfile } from './types'

/** Neutral common-practice/pop profile; other genres start from this and override. */
export const genericProfile: GenreProfile = {
  id: 'generic',
  name: 'Generico (pop/tonale)',
  description: 'Armonia tonale di base, utile come riferimento neutro.',
  modePriors: {},
  transitions: {
    I: { IV: 3, V: 3, vi: 2.5, ii: 1.5, iii: 0.8, bVII: 0.8 },
    ii: { V: 4, IV: 1, 'vii°': 0.5, I: 0.5 },
    iii: { vi: 3, IV: 2, ii: 1 },
    IV: { V: 3, I: 3, ii: 1, vi: 1, iv: 0.8 },
    V: { I: 4, vi: 2, IV: 1 },
    vi: { IV: 3, ii: 2, V: 2, iii: 1 },
    'vii°': { I: 3, iii: 1 },
    i: { iv: 3, bVI: 2.5, bVII: 2.5, v: 1, V: 1.5, bIII: 1.5 },
    iv: { i: 2.5, V: 2, bVII: 2, v: 1 },
    v: { i: 2, bVI: 2 },
    bIII: { bVII: 2.5, iv: 2, bVI: 2 },
    bVI: { bVII: 3, bIII: 2, iv: 1.5, V: 1.5 },
    bVII: { i: 3, I: 3, IV: 2, bVI: 1.5, bIII: 1 },
  },
  colorChords: [
    { suffix: '7', weight: 0.6, label: 'settima di dominante' },
    { suffix: 'maj7', weight: 0.5, label: 'settima maggiore' },
    { suffix: 'sus4', weight: 0.4, label: 'sus4' },
    { suffix: 'add9', weight: 0.4, label: 'add9' },
  ],
  substitutionWeights: {
    relative: 0.7,
    modalInterchange: 0.5,
    secondaryDominant: 0.7,
    tritone: 0.3,
    chromaticMediant: 0.3,
    color: 0.5,
    power: 0.2,
    pedal: 0.3,
    retrograde: 0.3,
    keyChange: 0.5,
  },
  borrowedPalette: ['iv', 'bVII', 'bVI'],
  templates: [
    { name: 'Asse pop', romans: ['I', 'V', 'vi', 'IV'], description: 'Il loop pop più diffuso.', section: 'qualsiasi' },
    { name: 'Cadenza ii–V–I', romans: ['ii', 'V', 'I'], description: 'Cadenza perfetta preparata.', section: 'qualsiasi' },
    { name: 'Anni \'50', romans: ['I', 'vi', 'IV', 'V'], description: 'Doo-wop / ballad.', section: 'strofa' },
  ],
  melodyScales: ['ionian', 'aeolian', 'majorPent', 'minorPent'],
  tips: [
    'Alterna tensione (V, IV) e riposo (I) per dare direzione alla frase.',
  ],
  defaultBpm: 100,
}
