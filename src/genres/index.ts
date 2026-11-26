import { altRockProfile } from './altRock'
import { genericProfile } from './generic'
import type { GenreProfile } from './types'

/** Register new genres here. */
export const GENRES: GenreProfile[] = [altRockProfile, genericProfile]

export function getGenre(id: string): GenreProfile {
  return GENRES.find((g) => g.id === id) ?? GENRES[0]
}

export type { GenreProfile } from './types'
