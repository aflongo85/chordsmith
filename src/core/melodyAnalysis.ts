import { mod12, prettyAccidentals, midiToName } from './notes'
import { type KeyCandidate, type KeyContext, type ModePriors, priorFor, rankCandidates, scalePcs, spellScale } from './key'
import { MODE_IDS, SCALES, type ModeId, type ScaleId } from './scales'
import { type MelodyNote, totalBeats } from './melody'

export interface ScaleFit {
  scale: ScaleId
  label: string
  tonic: string
  /** 0..1 share of note duration that lies inside the scale */
  fit: number
  outside: string[]
}

export interface Motif {
  /** semitone intervals between consecutive notes */
  intervals: number[]
  /** index (into the pitched-notes list) where each occurrence starts */
  starts: number[]
}

export interface MelodyAnalysis {
  pitched: number[]
  key: KeyContext
  candidates: KeyCandidate[]
  scaleFits: ScaleFit[]
  range: { low: string; high: string; semitones: number }
  /** semitone steps between consecutive notes (+ up, - down, 0 repeat) */
  contour: number[]
  stepwiseRatio: number
  largestLeap: number
  motifs: Motif[]
  beats: number
  observations: string[]
}

const MINOR_MODES = new Set<ModeId>(['aeolian', 'dorian', 'phrygian'])

export function detectKeyFromNotes(notes: MelodyNote[], priors?: ModePriors): KeyCandidate[] {
  const pitched = notes.filter((n): n is { midi: number; dur: number } => n.midi !== null)
  if (pitched.length === 0) return []
  const w = new Array(12).fill(0)
  for (const n of pitched) w[mod12(n.midi)] += n.dur
  const total = w.reduce((a, b) => a + b, 0)
  const firstPc = mod12(pitched[0].midi)
  const lastPc = mod12(pitched[pitched.length - 1].midi)
  const lowestPc = mod12(Math.min(...pitched.map((n) => n.midi)))

  const raw: { tonicPc: number; mode: ModeId; score: number }[] = []
  for (let t = 0; t < 12; t++) {
    for (const mode of MODE_IDS) {
      const pcs = new Set(scalePcs(t, mode))
      // in minor modes the b5 is the idiomatic "blue note": count it as mostly inside
      const blue = MINOR_MODES.has(mode) ? mod12(t + 6) : -1
      const inside = w.reduce((a, v, pc) => a + (pcs.has(pc) ? v : pc === blue ? v * 0.8 : 0), 0) / total
      let score = inside * 5
      score += (w[t] / total) * 2.5 + (w[mod12(t + 7)] / total) * 0.8
      const third = mode === 'ionian' || mode === 'lydian' || mode === 'mixolydian' ? 4 : 3
      score += (w[mod12(t + third)] / total) * 0.6
      if (firstPc === t) score += 0.5
      if (lastPc === t) score += 0.6
      if (lowestPc === t) score += 0.8 // riffs usually sit on the tonic as lowest note
      score += priorFor(mode, priors)
      raw.push({ tonicPc: t, mode, score })
    }
  }
  return rankCandidates(raw)
}

function scaleFits(pitched: { midi: number; dur: number }[], key: KeyContext, preferred: ScaleId[]): ScaleFit[] {
  const total = pitched.reduce((a, n) => a + n.dur, 0)
  const all = [...new Set<ScaleId>([...preferred, ...(Object.keys(SCALES) as ScaleId[])])]
  const res = all.map((scale) => {
    const pcs = new Set(scalePcs(key.tonicPc, scale))
    const inside = pitched.filter((n) => pcs.has(mod12(n.midi))).reduce((a, n) => a + n.dur, 0) / total
    const outside = [...new Set(pitched.filter((n) => !pcs.has(mod12(n.midi))).map((n) => key.names[mod12(n.midi)]))]
    const pref = preferred.indexOf(scale)
    // smaller scales that still fit describe the melody more precisely; genre favourites win ties
    const rank = inside - SCALES[scale].intervals.length * 0.01 + (pref >= 0 ? (preferred.length - pref) * 0.002 : 0)
    return { scale, label: SCALES[scale].label, tonic: spellScale(key.tonicPc, scale).tonic, fit: inside, outside, rank }
  })
  return res
    .filter((r) => r.fit >= 0.75)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4)
    .map(({ rank: _rank, ...r }) => r)
}

/** Repeated interval patterns (transposition-invariant), longest first. */
export function findMotifs(pitched: number[]): Motif[] {
  const iv = pitched.slice(1).map((m, i) => m - pitched[i])
  const found: Motif[] = []
  const covered = new Set<string>()
  for (let len = Math.min(6, Math.floor(iv.length / 2)); len >= 2; len--) {
    const map = new Map<string, number[]>()
    for (let i = 0; i + len <= iv.length; i++) {
      const k = iv.slice(i, i + len).join(',')
      const starts = map.get(k) ?? []
      if (starts.length === 0 || i >= starts[starts.length - 1] + len) starts.push(i)
      map.set(k, starts)
    }
    for (const [k, starts] of map) {
      if (starts.length < 2) continue
      if ([...covered].some((c) => `,${c},`.includes(`,${k},`))) continue
      if (k.split(',').every((x) => x === '0')) continue // repeated single note isn't a motif
      found.push({ intervals: k.split(',').map(Number), starts })
      covered.add(k)
    }
  }
  return found.slice(0, 4)
}

function contourOf(pitched: number[]): number[] {
  return pitched.slice(1).map((m, i) => m - pitched[i])
}

const CHARACTERISTIC: Partial<Record<ModeId, { interval: number; text: string }>> = {
  dorian: { interval: 9, text: 'la sesta maggiore, nota caratteristica del dorico' },
  mixolydian: { interval: 10, text: 'la settima minore, nota caratteristica del misolidio' },
  phrygian: { interval: 1, text: 'la seconda minore, nota caratteristica del frigio' },
  lydian: { interval: 6, text: 'la quarta aumentata, nota caratteristica del lidio' },
}

export function analyzeMelody(
  notes: MelodyNote[],
  priors: ModePriors | undefined,
  preferredScales: ScaleId[],
  keyOverride?: KeyContext,
): MelodyAnalysis | null {
  const pitchedNotes = notes.filter((n): n is { midi: number; dur: number } => n.midi !== null)
  if (pitchedNotes.length < 2) return null
  const pitched = pitchedNotes.map((n) => n.midi)
  const candidates = detectKeyFromNotes(notes, priors)
  const key = keyOverride ?? candidates[0].key
  const low = Math.min(...pitched)
  const high = Math.max(...pitched)
  const iv = pitched.slice(1).map((m, i) => Math.abs(m - pitched[i]))
  const moving = iv.filter((x) => x > 0)
  const stepwise = moving.filter((x) => x <= 2).length
  const stepwiseRatio = moving.length ? stepwise / moving.length : 1
  const largestLeap = Math.max(0, ...iv)
  const motifs = findMotifs(pitched)
  const fits = scaleFits(pitchedNotes, key, preferredScales)
  const beats = totalBeats(notes)

  const obs: string[] = []
  const pcsUsed = new Set(pitched.map((m) => mod12(m - key.tonicPc)))
  if (fits[0]) {
    const f = fits[0]
    obs.push(
      `Le note stanno ${f.fit === 1 ? 'tutte' : `al ${Math.round(f.fit * 100)}%`} nella scala ${prettyAccidentals(f.tonic)} ${f.label}.`,
    )
  }
  if (pcsUsed.has(6) && (pcsUsed.has(3) || pcsUsed.has(10)))
    obs.push('Usi la quinta diminuita (blue note): suono blues/grunge.')
  const ch = CHARACTERISTIC[key.mode]
  if (ch && pcsUsed.has(ch.interval)) obs.push(`Compare ${ch.text}: sfruttala, è il colore del brano.`)
  if (stepwiseRatio >= 0.7) obs.push('Movimento soprattutto per gradi congiunti: cantabile, fluido.')
  else if (stepwiseRatio <= 0.35) obs.push('Molti salti: linea angolare, tipica dei riff; bilancia con qualche passaggio per grado.')
  if (largestLeap >= 7) obs.push(`Salto massimo di ${largestLeap} semitoni: è un punto d'enfasi, mettilo su un accento forte.`)
  if (high - low <= 7) obs.push('Estensione stretta (entro una quinta): facile da cantare, ma un ritornello potrebbe salire più in alto.')
  if (high - low >= 15) obs.push('Estensione ampia (oltre l\'ottava): se è una linea vocale valuta la tessitura.')
  if (motifs.length) obs.push(`Motivo ricorrente di ${motifs[0].intervals.length + 1} note ripetuto ${motifs[0].starts.length} volte: è il "gancio", sviluppalo.`)
  if (mod12(pitched[pitched.length - 1]) === key.tonicPc) obs.push('Termina sulla tonica: frase conclusiva.')
  else obs.push('Non termina sulla tonica: frase aperta, ottima come "domanda" a cui rispondere.')

  return {
    pitched,
    key,
    candidates,
    scaleFits: fits,
    range: { low: midiToName(low, key.names), high: midiToName(high, key.names), semitones: high - low },
    contour: contourOf(pitched),
    stepwiseRatio,
    largestLeap,
    motifs,
    beats,
    observations: obs,
  }
}
