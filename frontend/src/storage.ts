import type { Conversation } from './types'

const CONVOS = 'artifact3.conversations'
const API_URL = 'artifact3.apiUrl'
const KEY = 'artifact3.key'

// Storage can throw (private windows, blocked site data), so every access is guarded.
function read(store: Storage, k: string): string | null {
  try {
    return store.getItem(k)
  } catch {
    return null
  }
}
function write(store: Storage, k: string, v: string | null) {
  try {
    if (v === null) store.removeItem(k)
    else store.setItem(k, v)
  } catch {
    /* ignore */
  }
}

export const defaultApiUrl: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export function loadApiUrl(): string {
  return read(localStorage, API_URL) ?? defaultApiUrl
}
export function saveApiUrl(url: string) {
  write(localStorage, API_URL, url)
}

export function loadKey(): string | null {
  return read(sessionStorage, KEY) ?? read(localStorage, KEY)
}
export function saveKey(key: string, remember: boolean) {
  write(sessionStorage, KEY, key)
  write(localStorage, KEY, remember ? key : null)
}
export function clearKey() {
  write(sessionStorage, KEY, null)
  write(localStorage, KEY, null)
}

export function loadConversations(): Conversation[] {
  const raw = read(localStorage, CONVOS)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
export function saveConversations(c: Conversation[]) {
  write(localStorage, CONVOS, JSON.stringify(c))
}
