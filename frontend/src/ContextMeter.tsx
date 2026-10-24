import { usePopover } from './usePopover'

const fmt = (n: number) => n.toLocaleString('en-US')

export type ContextLevel = 'ok' | 'warn' | 'full'

/** How close a chat is to its limit. Warns at 80% of the space usable for prompts. */
export function contextLevel(used: number, limit: number, reserve: number): ContextLevel {
  const usable = limit - reserve
  if (used > usable) return 'full'
  if (used >= usable * 0.8) return 'warn'
  return 'ok'
}

interface Props {
  /** Tokens already in the chat (including a reply that's streaming), or null while counting. */
  chat: number | null
  /** Tokens the unsent message would add. */
  draft: number
  limit: number
  /** Tokens always kept free so the model has room to answer. */
  reserve: number
}

/** Ring gauge in the composer; opens a breakdown of the context window. */
export function ContextMeter({ chat, draft, limit, reserve }: Props) {
  const { open, setOpen, ref } = usePopover()
  const used = (chat ?? 0) + draft
  const level = contextLevel(used, limit, reserve)
  const frac = Math.min(used / limit, 1)
  const pct = Math.round(frac * 100)
  const left = Math.max(limit - reserve - used, 0)

  const r = 7
  const c = 2 * Math.PI * r
  const seg = (n: number) => `${(Math.min(n, limit) / limit) * 100}%`

  return (
    <div className="ctx" ref={ref}>
      <button
        type="button"
        className={`ctx-chip ${level}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={chat === null ? 'Context window: counting' : `Context window: ${fmt(used)} of ${fmt(limit)} tokens used`}
        title="Context window"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden>
          <circle cx="9" cy="9" r={r} className="ctx-track" />
          <circle
            cx="9"
            cy="9"
            r={r}
            className="ctx-fill"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            transform="rotate(-90 9 9)"
          />
        </svg>
        {level !== 'ok' && <span>{level === 'full' ? 'Full' : `${pct}%`}</span>}
      </button>
      {open && (
        <div className="popover ctx-menu" role="dialog" aria-label="Context window">
          <div className="ctx-head">Context window</div>
          <div className="ctx-count">
            <span className="ctx-num">{chat === null ? '…' : fmt(used)}</span>
            <span className="ctx-of"> of {fmt(limit)} tokens</span>
          </div>
          <div className="ctx-bar" aria-hidden>
            <span className="ctx-bar-chat" style={{ width: seg(chat ?? 0) }} />
            <span className="ctx-bar-draft" style={{ width: seg(draft) }} />
            <span className="ctx-bar-reserve" style={{ width: seg(reserve) }} />
          </div>
          <ul className="ctx-legend">
            <li>
              <i className="ctx-bar-chat" />
              This chat
            </li>
            {draft > 0 && (
              <li>
                <i className="ctx-bar-draft" />
                Your message
              </li>
            )}
            <li>
              <i className="ctx-bar-reserve" />
              Kept free for the reply
            </li>
          </ul>
          <p className="ctx-note">
            {level === 'full'
              ? 'There’s no room left for another reply. Start a new chat to keep going.'
              : `About ${fmt(left)} tokens left for your messages. The model can only see ${fmt(limit)} tokens at once, so when this fills up you’ll need a new chat.`}
          </p>
        </div>
      )}
    </div>
  )
}
