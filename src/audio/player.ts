import type * as ToneNS from 'tone'
import type { MelodyNote } from '../core/melody'

export interface ChordEvent {
  midi: number[]
  beats: number
}

type ToneLib = typeof ToneNS

interface Engine {
  Tone: ToneLib
  guitar: ToneNS.Sampler
  crunch: ToneNS.Distortion
  room: ToneNS.FeedbackDelay
}

let enginePromise: Promise<Engine> | null = null
let engine: Engine | null = null
let crunchOn = false
/** semitones added to every note at playback (transposed tunings, e.g. -1 for Eb) */
let transpose = 0

/** One rendered sample every few semitones; the sampler repitches in between. */
const SAMPLE_NOTES = [40, 45, 50, 55, 59, 64, 69, 74]
const SAMPLE_SECONDS = 3.2

const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * Renders the clean-guitar tone (bright picked attack settling into a warm ring) once,
 * offline, into a handful of audio buffers. Playing them back costs almost nothing, so
 * phones don't crackle — real-time synthesis of every note was too heavy for them.
 */
async function renderSamples(Tone: ToneLib): Promise<Record<string, ToneNS.ToneAudioBuffer>> {
  const urls: Record<string, ToneNS.ToneAudioBuffer> = {}
  for (const midi of SAMPLE_NOTES) {
    const freq = Tone.Frequency(midi, 'midi')
    urls[freq.toNote()] = await Tone.Offline(() => {
      const body = new Tone.Filter({ frequency: 140, type: 'highpass', rolloff: -12 }).toDestination()
      const tone = new Tone.Filter({ frequency: 4200, type: 'lowpass', rolloff: -12 }).connect(body)
      const voice = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.004, decay: 1.2, sustain: 0.3, release: 0.4 },
        filter: { type: 'lowpass', Q: 0.7, rolloff: -12 },
        filterEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.35, release: 0.4, baseFrequency: 320, octaves: 3, exponent: 2 },
      }).connect(tone)
      voice.triggerAttackRelease(freq.toFrequency(), SAMPLE_SECONDS - 0.5, 0.002, 0.9)
    }, SAMPLE_SECONDS, 1)
  }
  return urls
}

async function load(): Promise<Engine> {
  const Tone = await import('tone')
  // phones get bigger audio buffers: a little more latency, no dropouts
  Tone.setContext(new Tone.Context({ latencyHint: isTouchDevice() ? 'playback' : 'interactive', lookAhead: 0.15 }))
  const urls = await renderSamples(Tone)
  const guitar = new Tone.Sampler({ urls, release: 0.6, volume: -4 })
  const crunch = new Tone.Distortion({ distortion: 0.5, oversample: 'none' })
  const room = new Tone.FeedbackDelay({ delayTime: 0.085, feedback: 0.22, wet: 0.14 })
  const limiter = new Tone.Limiter(-1)
  room.chain(limiter, Tone.getDestination())
  const e: Engine = { Tone, guitar, crunch, room }
  route(e)
  engine = e
  return e
}

/** The distortion is only in the signal path while it's switched on (no idle cost). */
function route(e: Engine) {
  e.guitar.disconnect()
  e.crunch.disconnect()
  if (crunchOn) {
    e.guitar.connect(e.crunch)
    e.crunch.connect(e.room)
  } else {
    e.guitar.connect(e.room)
  }
}

/** Loads Tone.js and renders the samples ahead of time (no user gesture needed). */
export function warmUp(): Promise<Engine> {
  enginePromise ??= load()
  return enginePromise
}

async function ensure(): Promise<Engine> {
  const e = await warmUp()
  await e.Tone.start()
  return e
}

function pluck(e: Engine, midi: number, time: number, seconds: number, velocity = 0.8) {
  // tiny random variation so repeated strums don't sound mechanical
  const v = Math.min(1, Math.max(0.2, velocity + (Math.random() - 0.5) * 0.1))
  const hold = Math.min(Math.max(seconds, 0.15), SAMPLE_SECONDS)
  e.guitar.triggerAttackRelease(e.Tone.Frequency(midi + transpose, 'midi').toNote(), hold, time, v)
}

function strum(e: Engine, midi: number[], time: number, seconds: number, down = true) {
  const notes = down ? midi : [...midi].reverse()
  notes.forEach((m, i) => pluck(e, m, time + i * 0.018, seconds, down ? 0.75 : 0.5))
}

export function setTranspose(semitones: number) {
  transpose = semitones
}

export function setCrunch(on: boolean) {
  crunchOn = on
  if (engine) route(engine)
}

export async function previewNotes(midi: number[]) {
  const e = await ensure()
  strum(e, midi, e.Tone.now() + 0.01, 2.2)
}

export function stop() {
  if (!engine) return
  const tr = engine.Tone.getTransport()
  tr.stop()
  tr.cancel(0)
  tr.loop = false
}

export interface PlayOptions {
  bpm: number
  loop?: boolean
  chords?: ChordEvent[]
  melody?: MelodyNote[]
  onChord?: (index: number) => void
  onNote?: (index: number) => void
  onEnd?: () => void
}

/** Plays chords (strummed on every beat) and/or a melody, in sync. */
export async function play(opts: PlayOptions) {
  const e = await ensure()
  stop()
  const tr = e.Tone.getTransport()
  tr.bpm.value = opts.bpm
  const spb = 60 / opts.bpm
  const draw = e.Tone.getDraw()

  let chordBeats = 0
  opts.chords?.forEach((c, i) => {
    const start = chordBeats
    tr.schedule((time) => {
      draw.schedule(() => opts.onChord?.(i), time)
    }, start * spb)
    // strum on each beat, alternating down/up on the off-beats for a rock feel
    for (let b = 0; b < c.beats; b += 1) {
      tr.schedule((time) => strum(e, c.midi, time, spb * 0.95, true), (start + b) * spb)
      if (opts.melody === undefined && c.beats >= 2 && b % 2 === 1)
        tr.schedule((time) => strum(e, c.midi.slice(-3), time, spb * 0.45, false), (start + b + 0.5) * spb)
    }
    chordBeats += c.beats
  })

  let melodyBeats = 0
  opts.melody?.forEach((n, i) => {
    const at = melodyBeats * spb
    tr.schedule((time) => {
      if (n.midi !== null) pluck(e, n.midi + (opts.chords ? 12 : 0), time, n.dur * spb, 0.9)
      draw.schedule(() => opts.onNote?.(i), time)
    }, at)
    melodyBeats += n.dur
  })

  const total = Math.max(chordBeats, melodyBeats)
  if (total === 0) return
  if (opts.loop) {
    tr.loop = true
    tr.loopStart = 0
    tr.loopEnd = total * spb
  } else {
    tr.schedule((time) => {
      draw.schedule(() => {
        stop()
        opts.onEnd?.()
      }, time)
    }, total * spb + 0.6)
  }
  tr.position = 0
  tr.start('+0.05')
}
