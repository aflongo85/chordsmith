import type { Idea } from '../state/store'

export const ideaVersion = (i: Idea): number => i.updatedAt ?? i.createdAt

/**
 * Merges the ideas of this device with the ones in the cloud, idea by idea:
 * the most recently changed copy wins (deletions included, as tombstones).
 * `toPush` lists what this device has that the cloud is missing or has older.
 */
export function mergeIdeas(local: Idea[], remote: Idea[]): { merged: Idea[]; toPush: Idea[] } {
  const byId = new Map<string, { l?: Idea; r?: Idea }>()
  for (const l of local) byId.set(l.id, { ...byId.get(l.id), l })
  for (const r of remote) byId.set(r.id, { ...byId.get(r.id), r })
  const merged: Idea[] = []
  const toPush: Idea[] = []
  for (const { l, r } of byId.values()) {
    if (l && (!r || ideaVersion(l) > ideaVersion(r))) {
      merged.push(l)
      toPush.push(l)
    } else if (r) {
      merged.push(r)
    }
  }
  merged.sort((a, b) => a.createdAt - b.createdAt)
  return { merged, toPush }
}

/** Compact fingerprint of a list of ideas, to tell whether anything changed since the last sync. */
export const ideasSignature = (ideas: Idea[]): string =>
  ideas.map((i) => `${i.id}:${ideaVersion(i)}:${i.deleted ? 1 : 0}`).sort().join('|')
