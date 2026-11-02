import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

const NAV = [
  { to: '/', label: 'Terminal' },
  { to: '/trades', label: 'Positions' },
  { to: '/wallet', label: 'Wallet' },
] as const

const LINK_BASE = 'rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
const LINK_ACTIVE = 'bg-secondary! text-foreground!'

/** Four-point "north star" mark used as the brand logo. */
export function StarMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 1.5 14.3 9.7 22.5 12 14.3 14.3 12 22.5 9.7 14.3 1.5 12 9.7 9.7Z" />
    </svg>
  )
}

export function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-3 rounded-lg" aria-label="Northstar FX home">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><StarMark size={22} /></span>
      <span className="text-lg font-semibold tracking-tight">Northstar <span className="text-primary">FX</span></span>
    </Link>
  )
}

/** Sticky top bar shared by every page. `actions` sits on the right (account, balance, sign-in). */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: true }} className={LINK_BASE} activeProps={{ className: LINK_ACTIVE }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">{actions}</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden" aria-label="Main">
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} activeOptions={{ exact: true }} className={`${LINK_BASE} shrink-0`} activeProps={{ className: LINK_ACTIVE }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

/** Standard inner page: header, title block and a comfortably spaced content column. */
export function PageFrame({
  title,
  description,
  actions,
  width = 'max-w-6xl',
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  width?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className={`mx-auto w-full ${width} px-4 py-10 sm:px-6 sm:py-12 lg:px-8`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {description && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
