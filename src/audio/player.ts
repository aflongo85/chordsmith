import type * as ToneNS from 'tone'
import type { MelodyNote } from '../core/melody'

export interface ChordEvent {
  midi: number[]
  beats: number
}

type ToneLib = typeof ToneNS

interface Engine {
  Tone: ToneLib
  guitar: ToneNS.PolySynth<ToneNS.MonoSynth>
  crunch: ToneNS.Distortion
}

let engine: Engine | null = null
let crunchOn = false
/** semitones added to every note at playback (transposed tunings, e.g. -1 for Eb) */
let transpose = 0

/**
 * Clean electric-guitar-like voice: a bright, plucked attack (filter envelope opening and
 * closing fast) that decays to a round, warm tone, with no sustain — like a picked string.
 * Chorus and a short room reverb add the "clean channel" shimmer.
 */
async function ensure(): Promise<Engine> {
  if (engine) {
    await engine.Tone.start()
    return engine
  }
  const Tone = await import('tone')
  await Tone.start()
  const guitar = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 8 },
    envelope: { attack: 0.003, decay: 1.8, sustain: 0, release: 0.5 },
    filter: { type: 'lowpass', Q: 0.8, rolloff: -24 },
    filterEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.25, release: 0.6, baseFrequency: 260, octaves: 3.4, exponent: 2 },
  })
  guitar.maxPolyphony = 32
  guitar.volume.value = -16
  const crunch = new Tone.Distortion({ distortion: 0.5, wet: crunchOn ? 0.55 : 0 })
  const tone = new Tone.Filter({ frequency: 4200, type: 'lowpass', rolloff: -12 })
  const body = new Tone.Filter({ frequency: 180, type: 'highpass' })
  const chorus = new Tone.Chorus({ frequency: 1.2, delayTime: 3.5, depth: 0.35, wet: 0.35 }).start()
  const comp = new Tone.Compressor(-20, 3)
  const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.2 })
  guitar.chain(crunch, body, tone, chorus, comp, reverb, Tone.getDestination())
  engine = { Tone, guitar, crunch }
  return engine
}

function pluck(e: Engine, midi: number, time: number, seconds: number, velocity = 0.8) {
  // tiny random variation so repeated strums don't sound mechanical
  const v = Math.min(1, Math.max(0.2, velocity + (Math.random() - 0.5) * 0.1))
  e.guitar.triggerAttackRelease(e.Tone.Frequency(midi + transpose, 'midi').toFrequency(), Math.min(seconds, 2.5), time, v)
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
  if (engine) engine.crunch.wet.value = on ? 0.55 : 0
}

export async function previewNotes(midi: number[]) {
  const e = await ensure()
  strum(e, midi, e.Tone.now() + 0.01, 1.5)
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
      tr.schedule((time) => strum(e, c.midi, time, spb * 1.2, true), (start + b) * spb)
      if (opts.melody === undefined && c.beats >= 2 && b % 2 === 1)
        tr.schedule((time) => strum(e, c.midi.slice(-3), time, spb * 0.5, false), (start + b + 0.5) * spb)
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
