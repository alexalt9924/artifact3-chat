import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (p: P): P => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
})

/** The Artifact 3 mark: an eight-ray asterisk with alternating ray lengths. */
export function Spark({ className, ...p }: P) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden className={`spark ${className ?? ''}`} {...p}>
      <g stroke="currentColor" strokeLinecap="round" strokeWidth={2.6}>
        {rays.map((a, i) => (
          <line key={a} x1="12" y1="12" x2="12" y2={i % 2 ? 4.6 : 1.8} transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
    </svg>
  )
}

export const Plus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const PanelLeft = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
  </svg>
)

export const ArrowUp = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)

export const Stop = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </svg>
)

export const Copy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
)

export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12h9l1-12M9.5 7V4.5h5V7" />
  </svg>
)

export const LogOut = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h10" />
  </svg>
)

export const ChevronDown = (p: P) => (
  <svg {...base({ width: 14, height: 14, strokeWidth: 2, ...p })}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

/** A graphics card, for "running on a local GPU". */
export const Gpu = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6.5" width="19" height="10" rx="2" />
    <circle cx="9" cy="11.5" r="2.5" />
    <circle cx="16" cy="11.5" r="2.5" />
    <path d="M5 16.5v2.5M8 16.5v2.5M11 16.5v2.5" />
  </svg>
)
