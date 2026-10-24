import { useState, type FormEvent } from 'react'
import { verifyKey } from './api'
import { defaultApiUrl, loadApiUrl, saveApiUrl, saveKey } from './storage'

export default function Login({ onLogin }: { onLogin: (baseUrl: string, key: string) => void }) {
  const [password, setPassword] = useState('')
  const [apiUrl, setApiUrl] = useState(loadApiUrl())
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Only expose the URL field when no URL was baked in at build time.
  const [showUrl, setShowUrl] = useState(!defaultApiUrl)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const baseUrl = apiUrl.trim().replace(/\/+$/, '')
    if (!baseUrl) {
      setError('Enter the API URL.')
      setShowUrl(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await verifyKey(baseUrl, password)
      saveApiUrl(baseUrl)
      saveKey(password, remember)
      onLogin(baseUrl, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">A</div>
        <h1>Artifact 3</h1>
        <p className="muted">Enter the password to start chatting.</p>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        {showUrl && (
          <input
            type="url"
            placeholder="https://api.example.com"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            aria-label="API URL"
          />
        )}
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
        {!showUrl && (
          <button type="button" className="link" onClick={() => setShowUrl(true)}>
            Change API URL
          </button>
        )}
      </form>
    </main>
  )
}
