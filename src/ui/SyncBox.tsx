import { useState } from 'react'
import { friendlyError, type SyncApi } from '../sync/useIdeaSync'

const MIN_PASSWORD = 8

function since(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (f: () => Promise<void>): Promise<boolean> => {
    setBusy(true)
    setErr(null)
    try {
      await f()
      return true
    } catch (e) {
      setErr(friendlyError(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, err, run }
}

/** Optional password, set from a device that is already signed in (no email involved). */
function PasswordSetter({ sync }: { sync: SyncApi }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [done, setDone] = useState(false)
  const { busy, err, run } = useAction()

  if (!open)
    return (
      <div className="muted small">
        {done ? 'Password impostata: sugli altri dispositivi puoi accedere con email e password. ' : ''}
        <button className="link" onClick={() => setOpen(true)}>
          {done ? 'Cambia password' : 'Imposta una password'}
        </button>{' '}
        {!done && 'per collegare altri dispositivi senza aspettare l\'email.'}
      </div>
    )

  const mismatch = pw2.length > 0 && pw !== pw2
  return (
    <form
      className="editor-row"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => sync.setPassword(pw)).then((ok) => {
          if (!ok) return
          setDone(true)
          setOpen(false)
          setPw('')
          setPw2('')
        })
      }}
    >
      <label className="field grow">
        <span>Nuova password (min. {MIN_PASSWORD} caratteri)</span>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <label className="field grow">
        <span>Ripeti password</span>
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      <button className="btn primary align-end" disabled={busy || pw.length < MIN_PASSWORD || pw !== pw2}>
        {busy ? 'Salvo…' : 'Salva password'}
      </button>
      <button type="button" className="btn align-end" onClick={() => setOpen(false)}>
        Annulla
      </button>
      {mismatch && <p className="error full">Le due password non coincidono.</p>}
      {err && <p className="error full">{err}</p>}
    </form>
  )
}

/** Sign-in (email link, or email + password) and sync status for saved ideas. */
export function SyncBox({ sync }: { sync: SyncApi }) {
  const [mode, setMode] = useState<'link' | 'password'>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const { busy, err, run } = useAction()

  if (!sync.configured) return null

  if (sync.email) {
    const status =
      sync.status === 'syncing'
        ? 'Sincronizzo…'
        : sync.status === 'offline'
          ? 'Offline: sincronizzo appena torna la rete'
          : sync.status === 'error'
            ? `Errore: ${sync.error}`
            : sync.lastSync
              ? `Sincronizzate alle ${since(sync.lastSync)}`
              : 'Connesso'
    return (
      <div className={`sync-box ${sync.status === 'error' ? 'sync-error' : ''}`}>
        <div className="sync-row">
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
        <PasswordSetter sync={sync} />
      </div>
    )
  }

  const emailField = (
    <label className="field grow">
      <span>Email</span>
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" />
    </label>
  )

  return (
    <div className="sync-box">
      <div>
        <strong>☁ Sincronizza le idee tra i dispositivi</strong>
        <div className="muted small">Accedi con la stessa email sul telefono e sul Mac.</div>
      </div>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>
          Link via email
        </button>
        <button role="tab" aria-selected={mode === 'password'} className={mode === 'password' ? 'on' : ''} onClick={() => setMode('password')}>
          Email e password
        </button>
      </div>

      {mode === 'password' ? (
        <form
          className="editor-row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => sync.signInWithPassword(email.trim(), password))
          }}
        >
          {emailField}
          <label className="field grow">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary align-end" disabled={busy || !email.includes('@') || !password}>
            {busy ? 'Accesso…' : 'Accedi'}
          </button>
          <p className="muted small full">
            La password si imposta da un dispositivo già collegato col link (riquadro della sincronizzazione → «Imposta una password»).
          </p>
        </form>
      ) : !sent ? (
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
          {emailField}
          <button className="btn primary align-end" disabled={busy || !email.includes('@')}>
            {busy ? 'Invio…' : 'Invia email'}
          </button>
        </form>
      ) : (
        <div className="sync-sent">
          <p className="full">
            Ti ho mandato un'email a <strong>{email}</strong>: tocca <strong>«Sign in»</strong> e l'app si apre già collegata. Va bene anche
            aprirla su un altro dispositivo: verrà collegato quello. Se non arriva, controlla lo spam.
          </p>
          <form
            className="editor-row"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => sync.verify(email.trim(), code.trim()))
            }}
          >
            <label className="field grow">
              <span>Hai ricevuto un codice a 6 cifre? (facoltativo)</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </label>
            <button className="btn align-end" disabled={busy || code.length < 6}>
              Accedi col codice
            </button>
            <button type="button" className="btn align-end" onClick={() => setSent(false)}>
              Cambia email
            </button>
          </form>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
