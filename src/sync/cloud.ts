import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Idea } from '../state/store'
import { SUPABASE_KEY, SUPABASE_URL } from './config'

let clientPromise: Promise<SupabaseClient> | null = null

/** The Supabase library is loaded only when sync is configured and used. */
export function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // implicit flow: the email link works even when opened on a different device
        flowType: 'implicit',
      },
    }),
  )
  return clientPromise
}

interface IdeaRow {
  id: string
  name: string
  progression: string
  melody: string
  genre_id: string
  created_at: number
  updated_at: number
  deleted: boolean
}

const toIdea = (r: IdeaRow): Idea => ({
  id: r.id,
  name: r.name,
  progression: r.progression,
  melody: r.melody,
  genreId: r.genre_id,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deleted: r.deleted || undefined,
})

const toRow = (i: Idea, userId: string) => ({
  user_id: userId,
  id: i.id,
  name: i.name,
  progression: i.progression,
  melody: i.melody,
  genre_id: i.genreId,
  created_at: i.createdAt,
  updated_at: i.updatedAt ?? i.createdAt,
  deleted: Boolean(i.deleted),
})

export async function fetchIdeas(): Promise<Idea[]> {
  const sb = await getClient()
  const { data, error } = await sb.from('ideas').select('id,name,progression,melody,genre_id,created_at,updated_at,deleted')
  if (error) throw error
  return (data as IdeaRow[]).map(toIdea)
}

export async function pushIdeas(ideas: Idea[], userId: string): Promise<void> {
  if (!ideas.length) return
  const sb = await getClient()
  const { error } = await sb.from('ideas').upsert(ideas.map((i) => toRow(i, userId)), { onConflict: 'user_id,id' })
  if (error) throw error
}

/** Sends an email with a sign-in link (and a one-time code, if the email template includes it). */
export async function sendSignInEmail(email: string): Promise<void> {
  const sb = await getClient()
  const redirect = window.location.origin + window.location.pathname
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyCode(email: string, token: string): Promise<void> {
  const sb = await getClient()
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

/** Sets (or changes) the password of the signed-in user: no email is sent. */
export async function setPassword(password: string): Promise<void> {
  const sb = await getClient()
  const { error } = await sb.auth.updateUser({ password })
  if (error) throw error
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const sb = await getClient()
  await sb.auth.signOut()
}

export async function watchSession(cb: (s: Session | null) => void): Promise<() => void> {
  const sb = await getClient()
  const { data } = await sb.auth.getSession()
  cb(data.session)
  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => cb(session))
  return () => sub.subscription.unsubscribe()
}
