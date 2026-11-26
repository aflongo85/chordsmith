import type * as ToneNS from 'tone'
import type { MelodyNote } from '../core/melody'

export interface ChordEvent {
  midi: number[]
  beats: number
}

type ToneLib = typeof ToneNS

interface Engine {
  Tone: ToneLib
  plucks: ToneNS.PluckSynth[]
  next: number
  crunch: ToneNS.Distortion
}

let engine: Engine | null = null
let crunchOn = false

async function ensure(): Promise<Engine> {
  if (engine) {
    await engine.Tone.start()
    return engine
  }
  const Tone = await import('tone')
  await Tone.start()
  const crunch = new Tone.Distortion({ distortion: 0.55, wet: crunchOn ? 0.6 : 0 })
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 })
  const comp = new Tone.Compressor(-18, 4)
  crunch.chain(comp, reverb, Tone.getDestination())
  const plucks = Array.from({ length: 14 }, () => {
    const p = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.97, release: 0.8 })
    p.volume.value = -4
    p.connect(crunch)
    return p
  })
  engine = { Tone, plucks, next: 0, crunch }
  return engine
}

function pluck(e: Engine, midi: number, time: number) {
  const p = e.plucks[e.next]
  e.next = (e.next + 1) % e.plucks.length
  p.triggerAttack(e.Tone.Frequency(midi, 'midi').toFrequency(), time)
}

function strum(e: Engine, midi: number[], time: number, down = true) {
  const notes = down ? midi : [...midi].reverse()
  notes.forEach((m, i) => pluck(e, m, time + i * 0.022))
}

export function setCrunch(on: boolean) {
  crunchOn = on
  if (engine) engine.crunch.wet.value = on ? 0.6 : 0
}

export async function previewNotes(midi: number[]) {
  const e = await ensure()
  strum(e, midi, e.Tone.now() + 0.01)
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
      tr.schedule((time) => strum(e, c.midi, time, true), (start + b) * spb)
      if (opts.melody === undefined && c.beats >= 2 && b % 2 === 1)
        tr.schedule((time) => strum(e, c.midi.slice(-3), time, false), (start + b + 0.5) * spb)
    }
    chordBeats += c.beats
  })

  let melodyBeats = 0
  opts.melody?.forEach((n, i) => {
    const at = melodyBeats * spb
    tr.schedule((time) => {
      if (n.midi !== null) pluck(e, n.midi + (opts.chords ? 12 : 0), time)
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
