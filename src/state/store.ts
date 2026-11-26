import { useEffect, useState } from 'react'

export interface Idea {
  id: string
  name: string
  progression: string
  melody: string
  genreId: string
  createdAt: number
}

export type Tab = 'progressione' | 'melodia' | 'idee'

export interface AppState {
  tab: Tab
  progression: string
  melody: string
  genreId: string
  instrumentId: string
  tuningId: string
  bpm: number
  beatsPerChord: number
  crunch: boolean
  /** "auto" or "<tonicPc>:<mode>" */
  progressionKey: string
  melodyKey: string
  withChords: boolean
  ideas: Idea[]
}

export const DEFAULT_STATE: AppState = {
  tab: 'progressione',
  progression: 'Em C G D',
  melody: 'E2/8 G2/8 A2/4 E2/8 G2/8 Bb2/8 A2/4 E2/8 G2/8 A2/4 G2/8 E2/2',
  genreId: 'alt-rock',
  instrumentId: 'guitar',
  tuningId: 'standard',
  bpm: 112,
  beatsPerChord: 4,
  crunch: false,
  progressionKey: 'auto',
  melodyKey: 'auto',
  withChords: false,
  ideas: [],
}

const STORAGE_KEY = 'chordsmith.state.v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<AppState>) }
  } catch {
    return DEFAULT_STATE
  }
}

export function usePersistentState() {
  const [state, setState] = useState<AppState>(load)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* storage unavailable (private mode): the app still works, it just won't remember */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [state])
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))
  return [state, update] as const
}
