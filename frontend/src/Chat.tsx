import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from './Markdown'
import { AuthError, countTokens, streamChat } from './api'
import { loadConversations, saveConversations } from './storage'
import type { Conversation, Message } from './types'

// Must match the server: TOTAL_CONTEXT / PARALLEL_SLOTS (32768 / 8 by default).
const SLOT_CONTEXT = 4096
const MAX_REPLY_TOKENS = 1024
const PROMPT_BUDGET = SLOT_CONTEXT - MAX_REPLY_TOKENS - 96

const uid = () => crypto.randomUUID()

/** Drops the oldest turns until the prompt fits in one server slot. Always keeps the latest message. */
async function fitHistory(baseUrl: string, key: string, history: Message[]): Promise<Message[]> {
  let msgs = history
  for (let i = 0; i < 6 && msgs.length > 1; i++) {
    const total = await countTokens(baseUrl, key, msgs.map((m) => m.content).join('\n'))
    // Chat template adds a few tokens per turn.
    if (total + msgs.length * 8 <= PROMPT_BUDGET) break
    msgs = msgs.slice(Math.max(1, Math.ceil(msgs.length / 4)))
  }
  return msgs
}

interface Props {
  baseUrl: string
  apiKey: string
  onLogout: () => void
}

export default function Chat({ baseUrl, apiKey, onLogout }: Props) {
  const [convos, setConvos] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(() => loadConversations()[0]?.id ?? null)
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => saveConversations(convos), [convos])

  const active = useMemo(() => convos.find((c) => c.id === activeId) ?? null, [convos, activeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [active?.messages])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`
  }, [input])

  const patchMessage = useCallback((cid: string, mid: string, fn: (m: Message) => Message) => {
    setConvos((cs) =>
      cs.map((c) =>
        c.id === cid ? { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === mid ? fn(m) : m)) } : c,
      ),
    )
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || generating) return

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const botMsg: Message = { id: uid(), role: 'assistant', content: '' }
    let cid = active?.id
    const prior = active?.messages.filter((m) => !m.error) ?? []

    if (cid) {
      const id = cid
      setConvos((cs) =>
        cs.map((c) => (c.id === id ? { ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, botMsg] } : c)),
      )
    } else {
      cid = uid()
      const title = text.length > 40 ? `${text.slice(0, 40)}…` : text
      setConvos((cs) => [{ id: cid!, title, messages: [userMsg, botMsg], updatedAt: Date.now() }, ...cs])
      setActiveId(cid)
    }
    setInput('')
    setGenerating(true)
    setWaiting(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const conversationId = cid
    try {
      const history = await fitHistory(baseUrl, apiKey, [...prior, userMsg])
      await streamChat({
        baseUrl,
        key: apiKey,
        messages: history.map(({ role, content }) => ({ role, content })),
        maxTokens: MAX_REPLY_TOKENS,
        signal: ctrl.signal,
        onReasoning: () => setWaiting(false),
        onToken: (t) => {
          setWaiting(false)
          patchMessage(conversationId, botMsg.id, (m) => ({ ...m, content: m.content + t }))
        },
      })
    } catch (err) {
      if (err instanceof AuthError) {
        onLogout()
        return
      }
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        patchMessage(conversationId, botMsg.id, (m) => ({
          ...m,
          error: true,
          content: m.content || `Sorry, that failed: ${msg}`,
        }))
      }
    } finally {
      setGenerating(false)
      setWaiting(false)
      abortRef.current = null
      taRef.current?.focus()
    }
  }

  const stop = () => abortRef.current?.abort()

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  const newChat = () => {
    setActiveId(null)
    setSidebar(false)
    taRef.current?.focus()
  }

  const remove = (id: string) => {
    setConvos((cs) => cs.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const sorted = useMemo(() => [...convos].sort((a, b) => b.updatedAt - a.updatedAt), [convos])

  return (
    <div className="app">
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="sidebar-head">
          <span className="brand">Artifact 3</span>
        </div>
        <button className="new-chat" onClick={newChat}>
          + New chat
        </button>
        <nav className="convos" aria-label="Conversations">
          {sorted.map((c) => (
            <div key={c.id} className={`convo ${c.id === activeId ? 'active' : ''}`}>
              <button
                className="convo-title"
                onClick={() => {
                  setActiveId(c.id)
                  setSidebar(false)
                }}
              >
                {c.title}
              </button>
              <button className="convo-del" aria-label={`Delete ${c.title}`} onClick={() => remove(c.id)}>
                ×
              </button>
            </div>
          ))}
        </nav>
        <button className="link logout" onClick={onLogout}>
          Log out
        </button>
      </aside>
      {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon" aria-label="Open sidebar" onClick={() => setSidebar(true)}>
            ☰
          </button>
          <span className="topbar-title">{active?.title ?? 'New chat'}</span>
        </header>

        <div className="scroll">
          {!active || active.messages.length === 0 ? (
            <div className="empty">
              <div className="logo">A</div>
              <h2>How can I help you today?</h2>
            </div>
          ) : (
            <div className="thread">
              {active.messages.map((m, i) => {
                const last = i === active.messages.length - 1
                return (
                  <div key={m.id} className={`msg ${m.role}`}>
                    {m.role === 'user' ? (
                      <div className="bubble">{m.content}</div>
                    ) : m.error ? (
                      <p className="error">{m.content}</p>
                    ) : m.content ? (
                      <Markdown text={m.content} />
                    ) : last && generating ? (
                      <p className="muted pulse">{waiting ? 'Waiting for a free slot…' : 'Thinking…'}</p>
                    ) : null}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              ref={taRef}
              rows={1}
              autoFocus
              placeholder="Message Artifact 3"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Message"
            />
            {generating ? (
              <button className="send stop" onClick={stop} aria-label="Stop generating">
                ■
              </button>
            ) : (
              <button className="send" onClick={() => void send()} disabled={!input.trim()} aria-label="Send">
                ↑
              </button>
            )}
          </div>
          <p className="footnote">Responses are generated by an AI model and may contain mistakes.</p>
        </div>
      </main>
    </div>
  )
}
