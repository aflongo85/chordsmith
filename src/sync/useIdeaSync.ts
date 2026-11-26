import { useCallback, useEffect, useRef, useState } from 'react'
import type { Idea } from '../state/store'
import { syncConfigured } from './config'
import { fetchIdeas, pushIdeas, sendSignInEmail, setPassword, signInWithPassword, signOut, verifyCode, watchSession } from './cloud'
import { ideasSignature, mergeIdeas } from './merge'

export interface SyncState {
  configured: boolean
  email: string | null
  status: 'idle' | 'syncing' | 'error' | 'offline'
  lastSync: number | null
  error: string | null
}

export interface SyncApi extends SyncState {
  sendEmail: (email: string) => Promise<void>
  verify: (email: string, code: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  setPassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => void
}

const TRANSLATIONS: [RegExp, string][] = [
  [/rate limit/i, 'Troppe email inviate: Supabase ne permette poche all\'ora. Riprova più tardi oppure accedi con la password.'],
  [/invalid login credentials/i, 'Email o password errati. La password va prima impostata da un dispositivo già collegato.'],
  [/password should be at least|weak password/i, 'Password troppo corta o debole: usa almeno 8 caratteri.'],
  [/same.*password|different from the old/i, 'È uguale alla password attuale.'],
  [/reauthenticat/i, 'Per sicurezza Supabase chiede un accesso recente: esci, rientra col link via email e riprova.'],
  [/failed to fetch|network/i, 'Connessione assente o instabile.'],
  [/permission denied/i, 'Permessi mancanti sul database: esegui le righe "grant" di supabase/schema.sql.'],
]

/** Supabase errors are in English and technical: show something actionable instead. */
export function friendlyError(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)
  return TRANSLATIONS.find(([re]) => re.test(raw))?.[1] ?? raw
}

/**
 * Local-first sync: ideas always live on the device (so the app works offline) and,
 * when signed in, are merged with the cloud copy on start, on every change, when the
 * app comes back to the foreground and when the network returns.
 */
export function useIdeaSync(ideas: Idea[], updateIdeas: (fn: (ideas: Idea[]) => Idea[]) => void): SyncApi {
  const configured = syncConfigured()
  const [state, setState] = useState<SyncState>({ configured, email: null, status: 'idle', lastSync: null, error: null })
  const userId = useRef<string | null>(null)
  const latest = useRef(ideas)
  const syncedSig = useRef<string | null>(null)
  const running = useRef(false)
  const again = useRef(false)

  useEffect(() => {
    latest.current = ideas
  }, [ideas])

  const sync = useCallback(async () => {
    if (!configured || !userId.current) return
    if (running.current) {
      again.current = true
      return
    }
    if (!navigator.onLine) {
      setState((s) => ({ ...s, status: 'offline' }))
      return
    }
    running.current = true
    setState((s) => ({ ...s, status: 'syncing', error: null }))
    try {
      const remote = await fetchIdeas()
      const { merged, toPush } = mergeIdeas(latest.current, remote)
      await pushIdeas(toPush, userId.current)
      // re-merge against the newest local state in case something changed meanwhile
      updateIdeas((cur) => mergeIdeas(cur, merged).merged)
      syncedSig.current = ideasSignature(merged)
      setState((s) => ({ ...s, status: 'idle', lastSync: Date.now() }))
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: friendlyError(e) }))
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        void sync()
      }
    }
  }, [configured, updateIdeas])

  // session: restore on start, react to sign in / sign out
  useEffect(() => {
    if (!configured) return
    let stop: (() => void) | undefined
    let cancelled = false
    void watchSession((session) => {
      const id = session?.user.id ?? null
      const changed = id !== userId.current
      userId.current = id
      setState((s) => ({ ...s, email: session?.user.email ?? null }))
      if (id && changed) void sync()
    }).then((unsub) => {
      if (cancelled) unsub()
      else stop = unsub
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [configured, sync])

  // local changes → push (debounced)
  useEffect(() => {
    if (!configured || !userId.current) return
    if (ideasSignature(ideas) === syncedSig.current) return
    const t = setTimeout(() => void sync(), 1200)
    return () => clearTimeout(t)
  }, [ideas, configured, sync])

  // back to the foreground / back online → pull
  useEffect(() => {
    if (!configured) return
    const onVisible = () => document.visibilityState === 'visible' && void sync()
    const onOnline = () => void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [configured, sync])

  return {
    ...state,
    sendEmail: async (email) => {
      await sendSignInEmail(email)
    },
    verify: async (email, code) => {
      await verifyCode(email, code)
    },
    signInWithPassword: async (email, password) => {
      await signInWithPassword(email, password)
    },
    setPassword: async (password) => {
      await setPassword(password)
    },
    signOut: async () => {
      await signOut()
      userId.current = null
      syncedSig.current = null
      setState((s) => ({ ...s, email: null, lastSync: null, status: 'idle', error: null }))
    },
    syncNow: () => void sync(),
  }
}
