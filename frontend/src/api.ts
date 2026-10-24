import type { Message } from './types'

export class AuthError extends Error {
  constructor() {
    super('Incorrect password')
  }
}

const headers = (key: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${key}`,
})

/** Checks the password against an endpoint that requires the API key. */
export async function verifyKey(baseUrl: string, key: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${baseUrl}/tokenize`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ content: 'ping' }),
    })
  } catch {
    throw new Error('Could not reach the server. Check the API URL.')
  }
  if (res.status === 401 || res.status === 403) throw new AuthError()
  if (!res.ok) throw new Error(`Server returned ${res.status}`)
}

type ChatMessage = Pick<Message, 'role' | 'content'>

/**
 * Exact prompt size for a conversation: renders it through the model's chat template, then tokenizes.
 * Falls back to a deliberately high estimate if the server can't be asked, so limits err on the safe side.
 */
export async function countChatTokens(baseUrl: string, key: string, messages: ChatMessage[]): Promise<number> {
  try {
    const tpl = await fetch(`${baseUrl}/apply-template`, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ messages }),
    })
    if (tpl.ok) {
      const { prompt } = await tpl.json()
      const res = await fetch(`${baseUrl}/tokenize`, {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify({ content: prompt }),
      })
      if (res.ok) return (await res.json()).tokens.length
    }
  } catch {
    /* fall through to estimate */
  }
  return messages.reduce((n, m) => n + Math.ceil(m.content.length / 3) + 8, 4)
}

interface StreamOpts {
  baseUrl: string
  key: string
  messages: ChatMessage[]
  maxTokens: number
  signal: AbortSignal
  onToken: (t: string) => void
  /** Fires for chain-of-thought tokens when the server has reasoning enabled. */
  onReasoning?: () => void
  /** Why generation ended: 'stop' normally, 'length' when it hit max_tokens. */
  onFinish?: (reason: string) => void
}

/** Streams a chat completion over SSE. Resolves when the stream ends. */
export async function streamChat(o: StreamOpts): Promise<void> {
  const res = await fetch(`${o.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(o.key),
    signal: o.signal,
    body: JSON.stringify({
      model: 'artifact-3',
      messages: o.messages,
      stream: true,
      max_tokens: o.maxTokens,
    }),
  })
  if (res.status === 401 || res.status === 403) throw new AuthError()
  if (!res.ok || !res.body) {
    let detail = ''
    try {
      detail = (await res.json())?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Server returned ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const choice = JSON.parse(data).choices?.[0]
        const delta = choice?.delta
        if (delta?.content) o.onToken(delta.content)
        else if (delta?.reasoning_content) o.onReasoning?.()
        if (choice?.finish_reason) o.onFinish?.(choice.finish_reason)
      } catch {
        /* partial or non-JSON line */
      }
    }
  }
}
