import { expect, it } from 'vitest'
import { friendlyError } from './useIdeaSync'

it('translates common Supabase errors', () => {
  expect(friendlyError(new Error('email rate limit exceeded'))).toMatch(/Troppe email/)
  expect(friendlyError({ message: 'Invalid login credentials' })).toMatch(/Email o password errati/)
  expect(friendlyError(new Error('Password should be at least 6 characters.'))).toMatch(/troppo corta/)
  expect(friendlyError(new Error('qualcos\'altro'))).toBe('qualcos\'altro')
})
