import { Check, ChevronDown, Gpu } from './Icons'
import { usePopover } from './usePopover'

// What's actually serving requests. Keep in sync with artifact/.env (MODEL_FILE, PARALLEL_SLOTS, TOTAL_CONTEXT).
export const MODEL_NAME = 'Artifact 3'
export const HARDWARE = 'RTX 4070'
export const TOY_NOTICE = `A toy model running locally on one ${HARDWARE}`

/** Composer model picker, Claude-style. There's only one model, so the menu explains what it is. */
export function ModelChip() {
  const { open, setOpen, ref } = usePopover()

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
        <div className="popover model-menu" role="dialog" aria-label="About this model">
          <div className="model-item">
            <div>
              <div className="model-item-name">{MODEL_NAME}</div>
              <div className="model-item-desc">An experimental 12B model. Often wrong. Good for playing around.</div>
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
              <dd>4,096 tokens per chat</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
