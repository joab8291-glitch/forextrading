import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
  Mail,
  LockKeyhole,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest, clearToken, getToken, setToken } from '@/lib/api'
import type { SimulatedTradesRow } from '@/lib/db-types'

const PAIRS = [
  { symbol: 'EUR/USD', tvSymbol: 'OANDA:EURUSD', price: 1.08426, change: 0.18, spread: '0.1', high: '1.08641', low: '1.08182' },
  { symbol: 'GBP/USD', tvSymbol: 'OANDA:GBPUSD', price: 1.26784, change: -0.12, spread: '0.2', high: '1.27120', low: '1.26433' },
  { symbol: 'USD/JPY', tvSymbol: 'OANDA:USDJPY', price: 149.622, change: 0.31, spread: '0.2', high: '149.881', low: '149.104' },
  { symbol: 'AUD/USD', tvSymbol: 'OANDA:AUDUSD', price: 0.65218, change: 0.07, spread: '0.2', high: '0.65401', low: '0.64927' },
  { symbol: 'USD/CAD', tvSymbol: 'OANDA:USDCAD', price: 1.36125, change: -0.08, spread: '0.3', high: '1.36402', low: '1.35890' },
  { symbol: 'USD/CHF', tvSymbol: 'OANDA:USDCHF', price: 0.90144, change: 0.04, spread: '0.3', high: '0.90311', low: '0.89922' },
]

const INTERVALS = [
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
]

type TradeSide = 'buy' | 'sell'
type MarketUser = { id: string; email?: string | null; displayName?: string | null } | null

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Northstar FX · Paper Trading Terminal' },
      { name: 'description', content: 'Explore forex markets and practise trades in a paper-trading terminal.' },
    ],
  }),
  component: TradingTerminal,
})

function TradingTerminal() {
  const [selectedSymbol, setSelectedSymbol] = useState(PAIRS[0].symbol)
  const [interval, setInterval] = useState('15')
  const [side, setSide] = useState<TradeSide>('buy')
  const [units, setUnits] = useState('10000')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [user, setUser] = useState<MarketUser>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [savingTrade, setSavingTrade] = useState(false)
  const [activeView, setActiveView] = useState<'open' | 'history'>('open')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [depositPhone, setDepositPhone] = useState('')
  const [depositBusy, setDepositBusy] = useState(false)
  const [depositRequestId, setDepositRequestId] = useState<string | null>(null)
  const [depositMessage, setDepositMessage] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const mpesaApiBase = (import.meta.env.VITE_MPESA_API_URL || 'https://webazi-digital-solutions.onrender.com').replace(/\/$/, '')

  const selected = PAIRS.find((pair) => pair.symbol === selectedSymbol) ?? PAIRS[0]
  const { data: trades = [], isLoading: tradesLoading, refetch: refreshTrades, isError: tradesError, error: tradesLoadError } = useQuery({
    queryKey: ['simulated_trades', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return []
      const result = await apiRequest<{ trades: SimulatedTradesRow[] }>('/forex/trades')
      return result.trades
    },
  })
  const openTrades = trades.filter((trade) => trade.status === 'open')
  const closedTrades = trades.filter((trade) => trade.status === 'closed')
  const chartUrl = useMemo(() => {
    const params = new URLSearchParams({
      symbol: selected.tvSymbol,
      interval,
      theme: 'dark',
      style: '1',
      locale: 'en',
      timezone: 'Etc/UTC',
      hide_top_toolbar: '0',
      hide_legend: '0',
      hide_side_toolbar: '0',
      allow_symbol_change: '0',
      withdateranges: '1',
      save_image: '0',
      calendar: '0',
      details: '0',
      hideideas: '1',
    })
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`
  }, [selected.tvSymbol, interval])

  useEffect(() => {
    let active = true
    const token = getToken()
    if (!token) { setAuthLoading(false); return }
    void apiRequest<{ user: NonNullable<MarketUser> }>('/forex/auth/me')
      .then((result) => { if (active) setUser(result.user) })
      .catch(() => { clearToken(); if (active) setUser(null) })
      .finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !authBusy) setAuthOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [authOpen, authBusy])

  useEffect(() => {
    if (tradesError) toast.error(tradesLoadError instanceof Error ? tradesLoadError.message : 'Could not load your paper trades.')
  }, [tradesError, tradesLoadError])

  useEffect(() => {
    let active = true
    async function loadWallet() {
      if (!user || !mpesaApiBase) {
        setWalletBalance(null)
        return
      }
      try {
        const token = getToken()
        const response = await fetch(`${mpesaApiBase}/forex/wallet`, {
          headers: { Authorization: `Bearer ${token || ''}` },
        })
        if (!response.ok) throw new Error('Wallet service unavailable')
        const data = await response.json()
        if (active) setWalletBalance(Number(data.balanceKes) || 0)
      } catch {
        if (active) setWalletBalance(null)
      }
    }
    void loadWallet()
    return () => { active = false }
  }, [user?.id, mpesaApiBase])

  useEffect(() => {
    if (!depositRequestId || !user || !mpesaApiBase) return
    let active = true
    const checkStatus = async () => {
      try {
        const token = getToken()
        const response = await fetch(`${mpesaApiBase}/forex/deposits/${encodeURIComponent(depositRequestId)}`, {
          headers: { Authorization: `Bearer ${token || ''}` },
        })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        if (data.status === 'completed') {
          setDepositMessage(`Payment received. Receipt: ${data.receipt || 'confirmed'}`)
          setDepositRequestId(null)
          const walletResponse = await fetch(`${mpesaApiBase}/forex/wallet`, {
            headers: { Authorization: `Bearer ${token || ''}` },
          })
          if (walletResponse.ok) {
            const wallet = await walletResponse.json()
            setWalletBalance(Number(wallet.balanceKes) || 0)
          }
          toast.success('Your Forex cash wallet has been credited.')
        } else if (data.status === 'failed') {
          setDepositMessage(data.error || 'M-Pesa payment was not completed.')
          setDepositRequestId(null)
          toast.error('The deposit was not completed.')
        }
      } catch {
        // Keep polling through temporary network interruptions.
      }
    }
    void checkStatus()
    const timer = window.setInterval(() => { void checkStatus() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [depositRequestId, user?.id, mpesaApiBase])

  async function startDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) { signIn(); return }
    if (!mpesaApiBase) {
      toast.error('M-Pesa payment service is not configured.')
      return
    }
    const amount = Number(depositAmount)
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000) {
      toast.error('Enter a whole KES amount between 100 and 100,000.')
      return
    }
    if (!depositPhone.trim()) {
      toast.error('Enter the M-Pesa phone number to charge.')
      return
    }
    setDepositBusy(true)
    setDepositMessage('')
    try {
      const token = getToken()
      const response = await fetch(`${mpesaApiBase}/forex/deposits/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ amount, phone: depositPhone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start M-Pesa payment.')
      setDepositRequestId(data.merchantRequestId)
      setDepositMessage(data.customerMessage || 'STK prompt sent. Enter your M-Pesa PIN to complete the deposit.')
      toast.success('M-Pesa payment prompt sent to your phone.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the deposit.')
    } finally {
      setDepositBusy(false)
    }
  }

  function signIn() {
    setAuthMode('login')
    setAuthOpen(true)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    try {
      const endpoint = authMode === 'register' ? '/forex/auth/register' : '/forex/auth/login'
      const result = await apiRequest<{ token: string; user: NonNullable<MarketUser> }>(endpoint, {
        method: 'POST', body: JSON.stringify({ email: authEmail.trim(), password: authPassword, displayName: authName.trim() }),
      })
      setToken(result.token); setUser(result.user); setAuthOpen(false); setAuthPassword('')
      toast.success(authMode === 'register' ? 'Your Forex account is ready.' : 'Welcome back.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not authenticate.') }
    finally { setAuthBusy(false) }
  }

  async function signOut() {
    try { await apiRequest('/forex/auth/logout', { method: 'POST' }) } catch { /* clear local session even if offline */ }
    clearToken(); setUser(null); setWalletBalance(null); await refreshTrades(); toast.success('You have signed out.')
  }

  async function placePaperTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      signIn()
      return
    }
    const quantity = Number(units)
    if (!Number.isFinite(quantity) || quantity < 1000 || quantity > 1000000) {
      toast.error('Enter a size between 1,000 and 1,000,000 units.')
      return
    }
    const stop = stopLoss.trim() ? Number(stopLoss) : null
    const target = takeProfit.trim() ? Number(takeProfit) : null
    if ((stop !== null && (!Number.isFinite(stop) || stop <= 0)) || (target !== null && (!Number.isFinite(target) || target <= 0))) {
      toast.error('Stop loss and take profit must be positive prices.')
      return
    }
    if ((side === 'buy' && ((stop !== null && stop >= selected.price) || (target !== null && target <= selected.price))) || (side === 'sell' && ((stop !== null && stop <= selected.price) || (target !== null && target >= selected.price)))) {
      toast.error(side === 'buy' ? 'For a long paper trade, stop loss must be below entry and take profit above it.' : 'For a short paper trade, stop loss must be above entry and take profit below it.')
      return
    }
    setSavingTrade(true)
    try {
      await apiRequest('/forex/trades', { method: 'POST', body: JSON.stringify({ symbol: selected.symbol, side, quantity, entryPrice: selected.price, stopLoss: stop, takeProfit: target }) })
      await refreshTrades()
      toast.success(`${side === 'buy' ? 'Long' : 'Short'} ${selected.symbol} added to paper positions.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Your paper trade could not be saved.')
    } finally {
      setSavingTrade(false)
    }
  }

  async function closePaperTrade(trade: SimulatedTradesRow) {
    if (!user) return
    try {
      await apiRequest('/forex/trades/' + encodeURIComponent(trade.id) + '/close', { method: 'PATCH', body: JSON.stringify({ exitPrice: pairPrice(trade.symbol) }) })
      await refreshTrades()
      toast.success(`${trade.symbol} paper position closed.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close this paper position.')
    }
  }

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileNavOpen(false)
  }

  const [featuresOpen, setFeaturesOpen] = useState(false)

  return (
    <main className="terminal-shell min-h-dvh overflow-hidden text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Activity size={18}/></div>
            <div className="min-w-0"><div className="font-mono text-[13px] font-bold tracking-[0.14em]">NORTHSTAR <span className="text-primary">FX</span></div><div className="hidden text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:block">Markets workspace</div></div>
            <div className="ml-3 hidden h-7 w-px bg-border lg:block"/>
            <div className="relative">
              <button type="button" aria-expanded={featuresOpen} aria-haspopup="menu" onClick={() => setFeaturesOpen(value => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <Menu size={16}/> Features <ChevronDown size={14} className={featuresOpen ? 'rotate-180 transition-transform' : 'transition-transform'}/>
              </button>
              {featuresOpen && <><button aria-label="Close features menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setFeaturesOpen(false)}/><div role="menu" className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <div className="px-3 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace features</div>
                <a role="menuitem" href="/" onClick={() => setFeaturesOpen(false)} className="flex items-center gap-3 rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-primary"><BarChart3 size={17}/> Live chart <span className="ml-auto text-[9px]">OPEN</span></a>
                <a role="menuitem" href="/trade" onClick={() => setFeaturesOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-accent"><Activity size={17} className="text-primary"/> Practice trading</a>
                <a role="menuitem" href="/trades" onClick={() => setFeaturesOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-accent"><Wallet size={17} className="text-primary"/> Positions & history</a>
                <a role="menuitem" href="/wallet" onClick={() => setFeaturesOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-foreground transition hover:bg-accent"><ArrowUpRight size={17} className="text-primary"/> Wallet & deposits</a>
              </div></>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground sm:inline">PAPER · $100,000</span>
            {authLoading ? <div className="h-8 w-20 animate-pulse rounded-md bg-muted"/> : user ? <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] hover:bg-accent"><span className="size-1.5 rounded-full bg-primary"/><span className="max-w-28 truncate">{user.email}</span><LogOut size={13}/></button> : <button type="button" onClick={signIn} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:translate-y-0"><LogIn size={17} strokeWidth={2.25}/>Sign in</button>}
          </div>
        </div>

      </header>

      <div className="flex min-h-[calc(100dvh-56px)]">


        <div className="grid min-w-0 flex-1 grid-cols-1">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[10px] font-bold text-primary">{selected.symbol.slice(0,3)}</div>
                <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="font-mono text-base font-bold">{selected.symbol}</h1><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">FOREX</span></div><div className="text-[10px] text-muted-foreground">Spot market · indicative quote</div></div>
                <div className="ml-2 hidden sm:block"><div className="text-xs font-semibold text-primary">OANDA market feed</div><div className="text-[10px] text-muted-foreground">Live chart · TradingView</div></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="chart-pair">Market pair</label>
                <select id="chart-pair" value={selectedSymbol} onChange={event => setSelectedSymbol(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">{PAIRS.map(pair=><option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select>
                <div className="flex items-center gap-1 rounded-lg bg-card p-1" aria-label="Chart timeframe">{INTERVALS.map(item=><button key={item.value} onClick={()=>setInterval(item.value)} className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] ${interval===item.value?'bg-accent text-primary':'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>
              </div>
            </div>
            <div className="chart-grid h-[calc(100dvh-125px)] min-h-[420px] bg-background xl:h-[calc(100dvh-125px)]">
              <iframe key={chartUrl} title={`TradingView chart for ${selected.symbol}`} src={chartUrl} className="h-full w-full border-0" loading="eager" allow="clipboard-write"/>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2 text-[9px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary"/>Live chart powered by TradingView · OANDA</span><span>Practice environment · Quotes shown in the trade ticket are indicative samples</span></div>
          </section>


        </div>
      </div>

      {authOpen && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex h-[100dvh] min-h-[100svh] w-screen items-start justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black/90 px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md touch-pan-y sm:items-center sm:px-6 sm:py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}
        >
          <section className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-[440px] shrink-0 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-3xl border border-border/80 bg-card p-5 shadow-[0_28px_100px_-24px_rgba(0,0,0,0.95)] sm:my-auto sm:max-h-[calc(100dvh-4rem)] sm:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Activity size={21}/></div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Northstar FX account</p>
                <h2 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight">
                  {authMode === 'register' ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {authMode === 'register' ? 'Create an account to save and manage your practice positions.' : 'Sign in to access your paper-trading account and wallet.'}
                </p>
              </div>
              <button type="button" onClick={() => setAuthOpen(false)} aria-label="Close sign-in dialog" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-foreground"><X size={17}/></button>
            </div>
            <form onSubmit={submitAuth} className="space-y-5">
              {authMode === 'register' && (
                <label className="block space-y-2 text-sm font-medium text-foreground">
                  <span className="flex items-center gap-2"><UserRound size={14} className="text-primary"/>Full name</span>
                  <input required minLength={2} maxLength={80} autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} className="w-full rounded-xl border border-border/90 bg-background/80 px-4 py-3.5 text-base text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/80 hover:border-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15" placeholder="Your full name" />
                </label>
              )}
              <label className="block space-y-2 text-sm font-medium text-foreground">
                <span className="flex items-center gap-2"><Mail size={14} className="text-primary"/>Email address</span>
                <input required type="email" autoComplete="email" inputMode="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full rounded-xl border border-border/90 bg-background/80 px-4 py-3.5 text-base text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/80 hover:border-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15" placeholder="you@example.com" />
              </label>
              <label className="block space-y-2 text-sm font-medium text-foreground">
                <span className="flex items-center gap-2"><LockKeyhole size={14} className="text-primary"/>Password</span>
                <input required type="password" minLength={authMode === 'register' ? 10 : 1} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full rounded-xl border border-border/90 bg-background/80 px-4 py-3.5 text-base text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/80 hover:border-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15" placeholder={authMode === 'register' ? 'At least 10 characters' : 'Enter your password'} />
                {authMode === 'register' && <span className="block text-xs font-normal leading-relaxed text-muted-foreground">Use at least 10 characters.</span>}
              </label>
              <button type="submit" disabled={authBusy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/15 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                {authBusy ? 'Please wait…' : <><LogIn size={18} strokeWidth={2.25}/>{authMode === 'register' ? 'Create account' : 'Sign in securely'}</>}
              </button>
            </form>
            <p className="mt-6 border-t border-border pt-5 text-center text-sm leading-relaxed text-muted-foreground">
              {authMode === 'register' ? 'Already registered?' : 'New to Northstar FX?'}
              {' '}
              <button type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthPassword('') }} className="font-semibold text-primary hover:underline">
                {authMode === 'register' ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </section>
        </div>,
        document.body,
      )}
    </main>
  )
}

function RailButton({ children, label, active = false, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button title={label} aria-label={label} onClick={onClick} className={`flex size-10 items-center justify-center rounded-xl transition ${active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>{children}</button>
}

function MobileNavButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground hover:bg-accent">{children}</button>
}

function Metric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-border/80 bg-card px-3.5 py-3.5 shadow-sm sm:px-4"><div className="mb-2.5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span>{label}</span><span className="text-primary/75">{icon}</span></div><div className="font-mono text-lg font-semibold tracking-tight sm:text-xl">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{sub}</div></div>
}

function formatPrice(price: number, symbol: string) {
  const digits = symbol.endsWith('JPY') ? 3 : 5
  return price.toFixed(digits)
}

function pairPrice(symbol: string) {
  return PAIRS.find((pair) => pair.symbol === symbol)?.price ?? 0
}
