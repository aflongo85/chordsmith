import { useState } from 'react'
import type { SyncApi } from '../sync/useIdeaSync'

function since(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** Sign-in (email link or 6-digit code) and sync status for saved ideas. */
export function SyncBox({ sync }: { sync: SyncApi }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!sync.configured) return null

  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await f()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (sync.email) {
    const status =
      sync.status === 'syncing'
        ? 'Sincronizzo…'
        : sync.status === 'offline'
          ? 'Offline: sincronizzo appena torna la rete'
          : sync.status === 'error'
            ? `Errore di sincronizzazione: ${sync.error}`
            : sync.lastSync
              ? `Sincronizzate alle ${since(sync.lastSync)}`
              : 'Connesso'
    return (
      <div className={`sync-box ${sync.status === 'error' ? 'sync-error' : ''}`}>
        <div>
          <strong>☁ Sincronizzazione attiva</strong>
          <div className="muted small">
            {sync.email} · {status}
          </div>
        </div>
        <div className="sugg-actions">
          <button className="btn small" onClick={sync.syncNow} disabled={sync.status === 'syncing'}>
            Sincronizza ora
          </button>
          <button className="btn small" onClick={() => void run(sync.signOut)} disabled={busy}>
            Esci
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sync-box">
      <div>
        <strong>☁ Sincronizza le idee tra i dispositivi</strong>
        <div className="muted small">
          Accedi con la stessa email sul telefono e sul Mac. Niente password: ricevi un'email con un link e un codice.
        </div>
      </div>
      {!sent ? (
        <form
          className="editor-row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await sync.sendEmail(email.trim())
              setSent(true)
            })
          }}
        >
          <label className="field grow">
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" />
          </label>
          <button className="btn primary align-end" disabled={busy || !email.includes('@')}>
            {busy ? 'Invio…' : 'Invia email'}
          </button>
        </form>
      ) : (
        <form
          className="editor-row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => sync.verify(email.trim(), code.trim()))
          }}
        >
          <label className="field grow">
            <span>Codice ricevuto via email</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </label>
          <button className="btn primary align-end" disabled={busy || code.length < 6}>
            Accedi
          </button>
          <button type="button" className="btn align-end" onClick={() => setSent(false)}>
            Cambia email
          </button>
          <p className="muted small full">
            Oppure tocca il link nell'email: si apre l'app già collegata. Se non arriva, controlla lo spam.
          </p>
        </form>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
