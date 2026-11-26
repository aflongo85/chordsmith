import { describe, expect, it } from 'vitest'
import type { Idea } from '../state/store'
import { ideasSignature, mergeIdeas } from './merge'

const idea = (id: string, updatedAt: number, extra: Partial<Idea> = {}): Idea => ({
  id,
  name: id,
  progression: 'Em C G D',
  melody: '',
  genreId: 'alt-rock',
  createdAt: 1,
  updatedAt,
  ...extra,
})

describe('mergeIdeas', () => {
  it('unites ideas from both devices', () => {
    const { merged, toPush } = mergeIdeas([idea('phone', 5)], [idea('mac', 5)])
    expect(merged.map((i) => i.id).sort()).toEqual(['mac', 'phone'])
    expect(toPush.map((i) => i.id)).toEqual(['phone'])
  })
  it('keeps the most recent edit', () => {
    const { merged, toPush } = mergeIdeas([idea('a', 10, { name: 'nuovo' })], [idea('a', 5, { name: 'vecchio' })])
    expect(merged[0].name).toBe('nuovo')
    expect(toPush).toHaveLength(1)
    const back = mergeIdeas([idea('a', 5, { name: 'vecchio' })], [idea('a', 10, { name: 'nuovo' })])
    expect(back.merged[0].name).toBe('nuovo')
    expect(back.toPush).toHaveLength(0)
  })
  it('propagates deletions as tombstones', () => {
    const { merged, toPush } = mergeIdeas([idea('a', 9, { deleted: true })], [idea('a', 5)])
    expect(merged[0].deleted).toBe(true)
    expect(toPush[0].deleted).toBe(true)
  })
  it('treats old saves without updatedAt by their creation time', () => {
    const old: Idea = { id: 'x', name: 'x', progression: '', melody: '', genreId: 'alt-rock', createdAt: 3 }
    expect(mergeIdeas([old], []).toPush).toHaveLength(1)
  })
  it('is stable once in sync', () => {
    const a = [idea('a', 1), idea('b', 2)]
    const { merged, toPush } = mergeIdeas(a, a)
    expect(toPush).toHaveLength(0)
    expect(ideasSignature(merged)).toBe(ideasSignature(a))
  })
})
