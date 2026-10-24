import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from './Markdown'
import { ArrowUp, Check, Copy, Gpu, LogOut, PanelLeft, Plus, Spark, Stop, Trash } from './Icons'
import { HARDWARE, MODEL_NAME, ModelChip, TOY_NOTICE } from './ModelInfo'
import { ContextMeter, contextLevel } from './ContextMeter'
import { AuthError, countChatTokens, streamChat } from './api'
import { loadConversations, saveConversations } from './storage'
import type { Conversation, Message } from './types'

// Must match the server: TOTAL_CONTEXT / PARALLEL_SLOTS (32768 / 8 by default).
// Prompt + reply must never exceed this, or the server's behavior is undefined.
const SLOT_CONTEXT = 4096
// A message can only be sent if it leaves at least this much room for the answer.
const REPLY_RESERVE = 512
// Slack for any count drift between the client and server.
const SAFETY = 16
const SEND_LIMIT = SLOT_CONTEXT - REPLY_RESERVE

const uid = () => crypto.randomUUID()

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Hello, night owl'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
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
  const [collapsed, setCollapsed] = useState(false)
  const [greeting] = useState(timeGreeting)
  // Token counts: the chat so far, the chat plus the unsent message, and the live total while a reply streams.
  const [chatTokens, setChatTokens] = useState<number | null>(0)
  const [draftTotal, setDraftTotal] = useState<number | null>(null)
  const [live, setLive] = useState<{ prompt: number; streamed: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => saveConversations(convos), [convos])

  const active = useMemo(() => convos.find((c) => c.id === activeId) ?? null, [convos, activeId])
  // What the model sees: failed and empty replies are left out.
  const history = useMemo(
    () => (active?.messages ?? []).filter((m) => !m.error && m.content).map(({ role, content }) => ({ role, content })),
    [active?.messages],
  )

  useEffect(() => setChatTokens(null), [activeId])

  useEffect(() => {
    if (generating) return
    if (!history.length) {
      setChatTokens(0)
      return
    }
    let cancelled = false
    void countChatTokens(baseUrl, apiKey, history).then((n) => !cancelled && setChatTokens(n))
    return () => {
      cancelled = true
    }
  }, [history, generating, baseUrl, apiKey])

  // Recount with the unsent message once typing pauses.
  useEffect(() => {
    const text = input.trim()
    if (generating || !text) {
      setDraftTotal(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void countChatTokens(baseUrl, apiKey, [...history, { role: 'user', content: text }]).then(
        (n) => !cancelled && setDraftTotal(n),
      )
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [input, history, generating, baseUrl, apiKey])

  const shownChat = live ? live.prompt + live.streamed : chatTokens
  const draftTokens = !live && chatTokens !== null && draftTotal !== null ? Math.max(draftTotal - chatTokens, 0) : 0
  const chatLevel = chatTokens === null ? 'ok' : contextLevel(chatTokens, SLOT_CONTEXT, REPLY_RESERVE)
  const chatFull = chatLevel === 'full'
  const draftTooLong = !chatFull && input.trim() !== '' && draftTotal !== null && draftTotal > SEND_LIMIT

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
    if (!text || generating || chatFull || sendingRef.current) return

    // Authoritative check right before sending: the whole prompt plus room for a reply must fit in the slot.
    sendingRef.current = true
    const prompt = [...history, { role: 'user' as const, content: text }]
    const promptTokens = await countChatTokens(baseUrl, apiKey, prompt)
    sendingRef.current = false
    if (promptTokens > SEND_LIMIT) {
      setDraftTotal(promptTokens)
      return
    }
    // No separate reply cap: the answer may use whatever room is left in the slot.
    const maxTokens = SLOT_CONTEXT - promptTokens - SAFETY

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const botMsg: Message = { id: uid(), role: 'assistant', content: '' }
    let cid = active?.id

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
    setLive({ prompt: promptTokens, streamed: 0 })

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const conversationId = cid
    let streamed = 0
    try {
      await streamChat({
        baseUrl,
        key: apiKey,
        messages: prompt,
        maxTokens,
        signal: ctrl.signal,
        onReasoning: () => setWaiting(false),
        onToken: (t) => {
          setWaiting(false)
          // The server streams about one token per chunk, close enough for a live gauge.
          streamed++
          setLive((l) => l && { ...l, streamed: l.streamed + 1 })
          patchMessage(conversationId, botMsg.id, (m) => ({ ...m, content: m.content + t }))
        },
        onFinish: (reason) => {
          if (reason === 'length') patchMessage(conversationId, botMsg.id, (m) => ({ ...m, cutOff: true }))
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
      setLive(null)
      // Hold the live estimate until the exact recount lands, so the gauge doesn't jump back.
      setChatTokens(promptTokens + streamed)
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
  const isEmpty = !active || active.messages.length === 0

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="sidebar-head">
          <span className="brand">
            <Spark />
            <span className="brand-name">Artifact 3</span>
          </span>
          <button
            className="icon desktop-only"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeft />
          </button>
        </div>
        <button className="new-chat" onClick={newChat} title="New chat">
          <span className="new-chat-dot">
            <Plus width={16} height={16} />
          </span>
          <span className="new-chat-label">New chat</span>
        </button>
        <nav className="convos" aria-label="Conversations">
          {sorted.length > 0 && <h3 className="convos-head">Recents</h3>}
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
              <button className="convo-del" aria-label={`Delete ${c.title}`} title="Delete" onClick={() => remove(c.id)}>
                <Trash width={16} height={16} />
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="host-badge" title={TOY_NOTICE}>
            <Gpu />
          </span>
          <span className="host-text">
            <span className="host-name">{MODEL_NAME}</span>
            <span className="host-sub">Toy model on an {HARDWARE}</span>
          </span>
          <button className="icon" aria-label="Log out" title="Log out" onClick={onLogout}>
            <LogOut width={18} height={18} />
          </button>
        </div>
      </aside>
      {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}

      <main className={`main ${isEmpty ? 'is-empty' : ''}`}>
        <header className="topbar">
          <button className="icon mobile-only" aria-label="Open sidebar" onClick={() => setSidebar(true)}>
            <PanelLeft />
          </button>
          <span className="topbar-title">{active?.title ?? ''}</span>
          <button className="icon mobile-only" aria-label="New chat" onClick={newChat}>
            <Plus />
          </button>
        </header>

        {isEmpty ? (
          <div className="hero">
            <p className="toy-badge">
              <Gpu />
              {TOY_NOTICE}
            </p>
            <h1 className="greeting">
              <Spark />
              {greeting}
            </h1>
          </div>
        ) : (
          <div className="scroll">
            <div className="thread">
              {active.messages.map((m, i) => {
                const last = i === active.messages.length - 1
                const streaming = last && generating
                return (
                  <div key={m.id} className={`msg ${m.role}`}>
                    {m.role === 'user' ? (
                      <div className="bubble">{m.content}</div>
                    ) : (
                      <>
                        {m.error ? (
                          <p className="error">{m.content}</p>
                        ) : m.content ? (
                          <Markdown text={m.content} />
                        ) : streaming ? (
                          <p className="status">
                            <Spark className="msg-spark busy" />
                            <span>{waiting ? 'Waiting for a free slot on the GPU…' : 'Thinking…'}</span>
                          </p>
                        ) : null}
                        {m.cutOff && (
                          <p className="msg-note">Reply cut off: this chat ran out of room.</p>
                        )}
                        {last && (m.content || !streaming) && <Spark className={`msg-spark ${streaming ? 'busy' : ''}`} />}
                        {!streaming && m.content && !m.error && <CopyButton text={m.content} />}
                      </>
                    )}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          </div>
        )}

        <div className="composer-wrap">
          {!generating && (chatFull || draftTooLong || chatLevel === 'warn') && (
            <div className={`composer-notice ${chatFull ? 'full' : ''}`} role="status">
              <span>
                {chatFull
                  ? 'This chat is full. Start a new chat to keep going.'
                  : draftTooLong && history.length === 0
                    ? `Your message is too long. The model can take about ${SEND_LIMIT.toLocaleString('en-US')} tokens at once, so shorten it.`
                    : draftTooLong
                      ? 'Your message is too long for the room left in this chat. Shorten it or start a new chat.'
                      : 'This chat is almost full. Start a new chat soon.'}
              </span>
              {(chatFull || (draftTooLong && history.length > 0)) && (
                <button type="button" onClick={newChat}>
                  Start new chat
                </button>
              )}
            </div>
          )}
          <div className="composer">
            <textarea
              ref={taRef}
              rows={isEmpty ? 2 : 1}
              autoFocus
              placeholder={
                isEmpty ? 'How can I help you today?' : chatFull ? 'This chat is full' : 'Reply to Artifact 3…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Message"
            />
            <div className="composer-bar">
              <ContextMeter chat={shownChat} draft={draftTokens} limit={SLOT_CONTEXT} reserve={REPLY_RESERVE} />
              <ModelChip />
              {generating ? (
                <button className="send stop" onClick={stop} aria-label="Stop generating" title="Stop">
                  <Stop />
                </button>
              ) : (
                <button className="send" onClick={() => void send()} disabled={!input.trim() || chatFull || draftTooLong} aria-label="Send">
                  <ArrowUp width={18} height={18} />
                </button>
              )}
            </div>
          </div>
          <p className="footnote">
            Artifact 3 is a small toy model running on one {HARDWARE} at home. It makes mistakes, so double-check
            anything important.
          </p>
        </div>
      </main>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="msg-actions">
      <button className="icon" onClick={copy} aria-label={copied ? 'Copied' : 'Copy response'} title="Copy">
        {copied ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
      </button>
    </div>
  )
}
