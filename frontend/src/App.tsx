import { useState } from 'react'
import Login from './Login'
import Chat from './Chat'
import { clearKey, loadApiUrl, loadKey } from './storage'

export default function App() {
  const [session, setSession] = useState<{ baseUrl: string; key: string } | null>(() => {
    const key = loadKey()
    const baseUrl = loadApiUrl()
    return key && baseUrl ? { baseUrl, key } : null
  })

  const logout = () => {
    clearKey()
    setSession(null)
  }

  return session ? (
    <Chat baseUrl={session.baseUrl} apiKey={session.key} onLogout={logout} />
  ) : (
    <Login onLogin={(baseUrl, key) => setSession({ baseUrl, key })} />
  )
}
