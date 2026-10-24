import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Gpu } from './Icons'

// What's actually serving requests. Keep in sync with artifact/.env (MODEL_FILE, PARALLEL_SLOTS, TOTAL_CONTEXT).
export const MODEL_NAME = 'Gemma 4 E4B'
export const HARDWARE = 'RTX 4070'
export const TOY_NOTICE = `A toy model running locally on one ${HARDWARE}`

/** Composer model picker, Claude-style. There's only one model, so the menu explains what it is. */
export function ModelChip() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="model" ref={ref}>
      <button
        type="button"
        className="model-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {MODEL_NAME}
        <ChevronDown />
      </button>
      {open && (
        <div className="model-menu" role="dialog" aria-label="About this model">
          <div className="model-item">
            <div>
              <div className="model-item-name">{MODEL_NAME}</div>
              <div className="model-item-desc">Small, fast, and often wrong. Good for playing around.</div>
            </div>
            <Check className="model-item-check" />
          </div>
          <div className="model-specs">
            <p>
              <Gpu />
              Runs on a single {HARDWARE} in a home server, not in the cloud.
            </p>
            <dl>
              <dt>Weights</dt>
              <dd>4-bit (Q4_K_M)</dd>
              <dt>Memory</dt>
              <dd>About 4,000 tokens per chat</dd>
              <dt>Sharing</dt>
              <dd>8 people at once, others wait</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
