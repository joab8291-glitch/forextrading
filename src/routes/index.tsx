import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest, clearToken, getToken, setToken, wakeServer } from '@/lib/api'
import type { SimulatedTradesRow } from '@/lib/db-types'
import { SiteHeader } from '@/components/SiteHeader'

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
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [savingTrade, setSavingTrade] = useState(false)
  const [activeView, setActiveView] = useState<'open' | 'history'>('open')
  const [depositAmount, setDepositAmount] = useState('1000')
  const [depositPhone, setDepositPhone] = useState('')
  const [depositBusy, setDepositBusy] = useState(false)
  const [depositRequestId, setDepositRequestId] = useState<string | null>(null)
  const [depositMessage, setDepositMessage] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [paperBalance, setPaperBalance] = useState<number | null>(null)
  const [paperMargin, setPaperMargin] = useState<number>(0)
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
  const { data: marketData } = useQuery({
    queryKey: ['forex_live_quotes'],
    queryFn: () => apiRequest<{ quotes: Array<{ symbol:string; price:number|null; bid:number|null; ask:number|null; timestamp:number|null }>; streaming:boolean }>('/forex/quotes'),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 1000,
  })
  const liveQuote = marketData?.quotes.find((quote) => quote.symbol === selectedSymbol)
  const selectedPrice = liveQuote?.price && liveQuote.timestamp && Date.now()/1000-liveQuote.timestamp < 30 ? liveQuote.price : null
  const openTrades = trades.filter((trade) => trade.status === 'open')
  const closedTrades = trades.filter((trade) => trade.status === 'closed')
  const floatingPnl = openTrades.reduce((sum, trade) => { const q = marketData?.quotes.find((item) => item.symbol === trade.symbol); if (!q?.timestamp || Date.now()/1000-q.timestamp > 30) return sum; const exit = trade.side === 'buy' ? Number(q.bid) : Number(q.ask); const raw = Number(trade.quantity) * (exit-Number(trade.entryPrice)) * (trade.side === 'buy' ? 1 : -1); return sum + (trade.symbol.endsWith('/USD') ? raw : raw/exit); }, 0)

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

  // The API sits on free hosting that sleeps when idle. Waking it on page load means
  // it is usually ready by the time someone opens the sign-in form.
  useEffect(() => { wakeServer() }, [])

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
    async function loadPaperAccount() {
      if (!user) { setPaperBalance(null); setPaperMargin(0); return }
      try {
        const account = await apiRequest<{ account: { balance: number; usedMargin: number } }>('/forex/account')
        if (active) { setPaperBalance(Number(account.account.balance)); setPaperMargin(Number(account.account.usedMargin)) }
      } catch { if (active) toast.error('Could not load your demo trading balance.') }
    }
    void loadPaperAccount()
    return () => { active = false }
  }, [user?.id])

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
    setAuthError('')
    setAuthNotice('')
    setAuthOpen(true)
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    // Free hosting can take up to a minute to wake up; say so instead of looking frozen.
    const wakeNotice = window.setTimeout(() => setAuthNotice('Still working. The server was asleep and is starting up, which can take up to a minute.'), 4000)
    try {
      const endpoint = authMode === 'register' ? '/forex/auth/register' : '/forex/auth/login'
      const result = await apiRequest<{ token: string; user: NonNullable<MarketUser> }>(endpoint, {
        method: 'POST', body: JSON.stringify({ email: authEmail.trim(), password: authPassword, displayName: authName.trim() }),
      }, { timeoutMs: 75000 })
      setToken(result.token); setUser(result.user); setAuthOpen(false); setAuthPassword('')
      toast.success(authMode === 'register' ? 'Your account is created and saved. You are signed in.' : 'Welcome back.')
    } catch (error) {
      // Shown inside the dialog: toasts render underneath the full-screen sign-in overlay.
      setAuthError(error instanceof Error ? error.message : 'Could not authenticate.')
    } finally {
      window.clearTimeout(wakeNotice)
      setAuthNotice('')
      setAuthBusy(false)
    }
  }

  async function signOut() {
    try { await apiRequest('/forex/auth/logout', { method: 'POST' }) } catch { /* clear local session even if offline */ }
    clearToken(); setUser(null); setWalletBalance(null); setPaperBalance(null); setPaperMargin(0); await refreshTrades(); toast.success('You have signed out.')
  }

  async function placePaperTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      signIn()
      return
    }
    const quantity = Number(units)
    if (!Number.isSafeInteger(quantity) || quantity < 1000 || quantity > 1000000) {
      toast.error('Enter a size between 1,000 and 1,000,000 units.')
      return
    }
    const stop = stopLoss.trim() ? Number(stopLoss) : null
    const target = takeProfit.trim() ? Number(takeProfit) : null
    if ((stop !== null && (!Number.isFinite(stop) || stop <= 0)) || (target !== null && (!Number.isFinite(target) || target <= 0))) {
      toast.error('Stop loss and take profit must be positive prices.')
      return
    }
    if (selectedPrice === null) { toast.error('Live market price is unavailable. Wait for a fresh quote before placing a practice trade.'); return }
    if ((side === 'buy' && ((stop !== null && stop >= selectedPrice) || (target !== null && target <= selectedPrice))) || (side === 'sell' && ((stop !== null && stop <= selectedPrice) || (target !== null && target >= selectedPrice)))) {
      toast.error(side === 'buy' ? 'For a long paper trade, stop loss must be below entry and take profit above it.' : 'For a short paper trade, stop loss must be above entry and take profit below it.')
      return
    }
    setSavingTrade(true)
    try {
      const saved = await apiRequest<{ trade: SimulatedTradesRow }>('/forex/trades', {
        method: 'POST',
        body: JSON.stringify({ symbol: selected.symbol, side, quantity, entryPrice: selectedPrice, stopLoss: stop, takeProfit: target }),
      })
      if (!saved.trade?.id || saved.trade.status !== 'open' || saved.trade.userId !== user.id) {
        throw new Error('The server did not confirm that this practice trade was saved to your account.')
      }
      const [refreshed, accountResult] = await Promise.all([refreshTrades(), apiRequest<{ account: { balance: number; usedMargin: number } }>("/forex/account")])
      setPaperBalance(Number(accountResult.account.balance)); setPaperMargin(Number(accountResult.account.usedMargin))
      if (refreshed.isError) {
        toast.warning('Trade saved successfully, but the positions list could not refresh. Use Refresh to reload it.')
      } else {
        toast.success(`${side === 'buy' ? 'Long' : 'Short'} ${selected.symbol} saved to your open positions.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Your paper trade could not be saved.')
    } finally {
      setSavingTrade(false)
    }
  }

  async function closePaperTrade(trade: SimulatedTradesRow) {
    if (!user) return
    const quote = marketData?.quotes.find((item) => item.symbol === trade.symbol)
    const exitPrice = trade.side === 'buy' ? quote?.bid : quote?.ask
    if (!exitPrice || !quote?.timestamp || Date.now()/1000-quote.timestamp > 30) { toast.error('A fresh live quote is required to close this position.'); return }
    try {
      const result = await apiRequest<{ trade: SimulatedTradesRow; account: { balance: number; usedMargin: number } }>('/forex/trades/' + encodeURIComponent(trade.id) + '/close', { method: 'PATCH', body: JSON.stringify({ exitPrice }) })
      setPaperBalance(Number(result.account.balance)); setPaperMargin(Number(result.account.usedMargin))
      await refreshTrades()
      const pnl = Number(result.trade.realizedPnlUsd ?? 0)
      toast.success(`${trade.symbol} closed: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} realised.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close this paper position.')
    }
  }

  const isUp = selected.change >= 0
  const units_n = Number(units) || 0
  const lots = units_n / 100000
  const positionValue = selectedPrice === null ? 0 : units_n * selectedPrice
  const quoteCurrency = selected.symbol.split('/')[1]
  const shown = activeView === 'open' ? openTrades : closedTrades
  const sideTone = side === 'buy' ? 'bg-up text-[#04120d] hover:brightness-110' : 'bg-down text-[#1c0508] hover:brightness-110'

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        actions={
          <>
            <span className="hidden items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground lg:inline-flex">
              Demo balance <strong className="num font-semibold text-foreground">{paperBalance === null ? "—" : paperBalance.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}</strong>
              <span className="h-5 w-px bg-border" />
              Floating P/L <strong className={`num font-semibold ${floatingPnl >= 0 ? "text-up" : "text-down"}`}>{floatingPnl >= 0 ? "+" : ""}{floatingPnl.toFixed(2)} USD</strong>
            </span>
            {authLoading ? (
              <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">{user.email}</span>
                <button type="button" onClick={() => void signOut()} className="btn btn-outline btn-sm"><LogOut size={16} />Sign out</button>
              </div>
            ) : (
              <button type="button" onClick={signIn} className="btn btn-primary btn-sm"><LogIn size={16} />Sign in</button>
            )}
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Quote header: the selected market and its live-style numbers */}
        <section className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6" aria-label="Selected market">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{selected.symbol}</h1>
              <span className="rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-muted-foreground">Spot forex</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{marketData?.streaming ? 'Live prices streamed from Twelve Data.' : 'Live market feed is not configured. Practice orders are disabled until fresh quotes arrive.'}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="num text-4xl font-semibold tracking-tight sm:text-5xl">{selectedPrice === null ? 'Waiting for live quote…' : formatPrice(selectedPrice, selected.symbol)}</div>
              <div className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span className="num">{isUp ? '+' : ''}{selected.change.toFixed(2)}% today</span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
              <div><dt className="text-muted-foreground">Day high</dt><dd className="num mt-1 font-medium">{selected.high}</dd></div>
              <div><dt className="text-muted-foreground">Day low</dt><dd className="num mt-1 font-medium">{selected.low}</dd></div>
              <div><dt className="text-muted-foreground">Spread</dt><dd className="num mt-1 font-medium">{selected.spread} pips</dd></div>
            </dl>
          </div>
        </section>

        {/* Pair picker for small screens */}
        <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 xl:hidden" role="tablist" aria-label="Markets">
          {PAIRS.map((pair) => (
            <button
              key={pair.symbol}
              type="button"
              role="tab"
              aria-selected={pair.symbol === selectedSymbol}
              onClick={() => setSelectedSymbol(pair.symbol)}
              className={`shrink-0 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${pair.symbol === selectedSymbol ? 'border-primary/60 bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
            >
              {pair.symbol}
            </button>
          ))}
        </div>

        {/* Workspace: markets, chart, trade ticket */}
        <div className="mt-6 grid gap-6 xl:mt-8 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="panel hidden self-start xl:block" aria-label="Markets">
            <div className="panel-head"><h2 className="text-base font-semibold">Markets</h2><span className="text-sm text-muted-foreground">{PAIRS.length} pairs</span></div>
            <ul className="p-2">
              {PAIRS.map((pair) => {
                const active = pair.symbol === selectedSymbol
                const up = pair.change >= 0
                return (
                  <li key={pair.symbol}>
                    <button
                      type="button"
                      onClick={() => setSelectedSymbol(pair.symbol)}
                      aria-pressed={active}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left transition-colors ${active ? 'bg-accent' : 'hover:bg-secondary'}`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${active ? 'text-accent-foreground' : ''}`}>{pair.symbol}</span>
                        <span className="num mt-0.5 block text-sm text-muted-foreground">{(() => { const q = marketData?.quotes.find((item) => item.symbol === pair.symbol); return q?.price && q.timestamp && Date.now()/1000-q.timestamp < 30 ? formatPrice(q.price,pair.symbol) : '—' })()}</span>
                      </span>
                      <span className={`num inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-up' : 'text-down'}`}>
                        {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                        {marketData?.streaming ? 'Live' : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <section className="panel min-w-0 self-start overflow-hidden" aria-label="Price chart">
            <div className="panel-head">
              <h2 className="text-base font-semibold">Chart</h2>
              <div className="segmented" role="group" aria-label="Chart timeframe">
                {INTERVALS.map((item) => (
                  <button key={item.value} type="button" aria-pressed={interval === item.value} onClick={() => setInterval(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="h-[460px] bg-background sm:h-[540px] xl:h-[640px]">
              <iframe key={chartUrl} title={`TradingView chart for ${selected.symbol}`} src={chartUrl} className="h-full w-full border-0" loading="eager" allow="clipboard-write" />
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
              <ShieldCheck size={16} className="shrink-0 text-primary" />
              Practice environment. Trade execution and risk checks use the backend live quote feed.
            </div>
          </section>

          <div className="space-y-6">
            <form onSubmit={placePaperTrade} className="panel" aria-label="Paper trade ticket">
              <div className="panel-head"><h2 className="text-base font-semibold">New paper trade</h2><span className="text-sm text-muted-foreground">{selected.symbol}</span></div>
              <div className="panel-body space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1.5" role="group" aria-label="Order side">
                  <button type="button" aria-pressed={side === 'buy'} onClick={() => setSide('buy')} className={`h-11 rounded-lg text-sm font-semibold transition-colors ${side === 'buy' ? 'bg-up text-[#04120d]' : 'text-muted-foreground hover:text-foreground'}`}>Buy</button>
                  <button type="button" aria-pressed={side === 'sell'} onClick={() => setSide('sell')} className={`h-11 rounded-lg text-sm font-semibold transition-colors ${side === 'sell' ? 'bg-down text-[#1c0508]' : 'text-muted-foreground hover:text-foreground'}`}>Sell</button>
                </div>

                <div>
                  <label htmlFor="trade-units" className="field-label">Size in units</label>
                  <input id="trade-units" className="field num" type="number" inputMode="numeric" min={1000} max={1000000} step={1000} value={units} onChange={(e) => setUnits(e.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['1000', '10000', '50000', '100000'].map((preset) => (
                      <button key={preset} type="button" onClick={() => setUnits(preset)} className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${units === preset ? 'border-primary/60 bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                        {Number(preset).toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="trade-sl" className="field-label">Stop loss</label>
                    <input id="trade-sl" className="field num" type="number" step="any" inputMode="decimal" placeholder="Optional" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="trade-tp" className="field-label">Take profit</label>
                    <input id="trade-tp" className="field num" type="number" step="any" inputMode="decimal" placeholder="Optional" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
                  </div>
                </div>

                <dl className="space-y-3 rounded-xl bg-background p-4 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Entry price</dt><dd className="num font-medium">{formatPrice((selectedPrice ?? 0), selected.symbol)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Size in lots</dt><dd className="num font-medium">{lots.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Position value</dt><dd className="num font-medium">{positionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {quoteCurrency}</dd></div>
                </dl>

                <button type="submit" disabled={savingTrade} className={`btn w-full ${sideTone}`}>
                  {savingTrade ? 'Saving trade…' : user ? `${side === 'buy' ? 'Buy' : 'Sell'} ${selected.symbol}` : 'Sign in to trade'}
                </button>
                <p className="text-center text-sm text-muted-foreground">Practice funds only. No real orders are placed.</p>
              </div>
            </form>

            <form onSubmit={startDeposit} className="panel" aria-label="Fund cash wallet">
              <div className="panel-head"><h2 className="text-base font-semibold">Cash wallet</h2><Wallet size={18} className="text-muted-foreground" /></div>
              <div className="panel-body space-y-5">
                <div>
                  <div className="text-sm text-muted-foreground">Balance in KES</div>
                  <div className="num mt-1 text-3xl font-semibold tracking-tight">
                    {walletBalance === null ? '—' : walletBalance.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 })}
                  </div>
                  {!user && <p className="field-hint">Sign in to see your wallet balance.</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="deposit-amount" className="field-label">Amount (KES)</label>
                    <input id="deposit-amount" className="field num" type="number" min={100} max={100000} step={1} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="deposit-phone" className="field-label">M-Pesa number</label>
                    <input id="deposit-phone" className="field num" type="tel" inputMode="tel" placeholder="07XXXXXXXX" value={depositPhone} onChange={(e) => setDepositPhone(e.target.value)} />
                  </div>
                </div>
                <button type="submit" disabled={depositBusy || Boolean(depositRequestId)} className="btn btn-outline w-full">
                  {depositBusy ? 'Sending prompt…' : depositRequestId ? 'Waiting for confirmation…' : user ? 'Request M-Pesa prompt' : 'Sign in to deposit'}
                </button>
                {depositMessage && <p aria-live="polite" className="rounded-lg bg-background p-3.5 text-sm leading-relaxed text-secondary-foreground">{depositMessage}</p>}
                <p className="text-sm text-muted-foreground">KES 100 to 100,000. Your cash wallet is separate from the practice balance.</p>
              </div>
            </form>
          </div>
        </div>

        {/* Positions */}
        <section className="panel mt-6 overflow-hidden" aria-label="Paper positions">
          <div className="panel-head">
            <div className="segmented" role="tablist" aria-label="Position view">
              <button type="button" role="tab" aria-selected={activeView === 'open'} onClick={() => setActiveView('open')}>Open ({openTrades.length})</button>
              <button type="button" role="tab" aria-selected={activeView === 'history'} onClick={() => setActiveView('history')}>History ({closedTrades.length})</button>
            </div>
            {user && <button type="button" onClick={() => void refreshTrades()} className="btn btn-outline btn-sm">Refresh</button>}
          </div>
          {!user ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-lg font-semibold">Sign in to see your positions</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">Your paper trades are saved to your account, so you can pick up where you left off on any device.</p>
              <button type="button" onClick={signIn} className="btn btn-primary mt-6">Sign in</button>
            </div>
          ) : tradesLoading ? (
            <div className="px-6 py-14 text-center text-muted-foreground">Loading your trades…</div>
          ) : shown.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-lg font-semibold">{activeView === 'open' ? 'No open positions' : 'No closed trades yet'}</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{activeView === 'open' ? 'Pick a market, set a size and place a paper trade from the ticket above.' : 'Trades you close will show up here with their exit price.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="px-6 py-3.5 font-medium">Market</th>
                    <th scope="col" className="px-6 py-3.5 font-medium">Side</th>
                    <th scope="col" className="px-6 py-3.5 font-medium">Units</th>
                    <th scope="col" className="px-6 py-3.5 font-medium">Entry</th>
                    {activeView === 'open' ? (<><th scope="col" className="px-6 py-3.5 font-medium">Stop loss</th><th scope="col" className="px-6 py-3.5 font-medium">Take profit</th></>) : (<th scope="col" className="px-6 py-3.5 font-medium">Exit</th>)}
                    <th scope="col" className="px-6 py-3.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((trade) => (
                    <tr key={trade.id} className="transition-colors hover:bg-secondary/50">
                      <td className="px-6 py-4 font-semibold">{trade.symbol}</td>
                      <td className={`px-6 py-4 font-medium ${trade.side === 'buy' ? 'text-up' : 'text-down'}`}>{trade.side === 'buy' ? 'Long' : 'Short'}</td>
                      <td className="num px-6 py-4">{Number(trade.quantity).toLocaleString()}</td>
                      <td className="num px-6 py-4">{formatPrice(Number(trade.entryPrice), trade.symbol)}</td>
                      {activeView === 'open' ? (
                        <>
                          <td className="num px-6 py-4 text-muted-foreground">{trade.stopLoss ?? '—'}</td>
                          <td className="num px-6 py-4 text-muted-foreground">{trade.takeProfit ?? '—'}</td>
                        </>
                      ) : (
                        <td className="num px-6 py-4 text-muted-foreground">{trade.exitPrice ?? '—'}</td>
                      )}
                      <td className="px-6 py-4 text-right">
                        {activeView === 'open' && <button type="button" onClick={() => void closePaperTrade(trade)} className="btn btn-outline btn-sm hover:border-down hover:text-down">Close</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {authOpen && createPortal(
        <div className="ns-auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button type="button" onClick={() => setAuthOpen(false)} aria-label="Close sign-in dialog" className="ns-auth-close"><X size={20}/></button>
          <div className="ns-auth-lamp" aria-hidden="true"><span /></div>
          <section className="ns-auth-card">
            <div className="ns-auth-brand"><span className="ns-auth-mark"><Activity size={25}/></span><span>NORTHSTAR <b>FX</b></span></div>
            <h1 id="auth-title">{authMode === 'register' ? 'Create account' : 'Login'}</h1>
            <p className="ns-auth-subtitle">{authMode === 'register' ? 'Start your trading practice journey' : 'Welcome back. Sign in to continue.'}</p>
            <form onSubmit={submitAuth} className="ns-auth-form">
              {authMode === 'register' && <label className="ns-auth-field"><UserRound size={20}/><input required minLength={2} maxLength={80} autoComplete="name" placeholder="Full name" aria-label="Full name" value={authName} onChange={e => setAuthName(e.target.value)}/></label>}
              <label className="ns-auth-field"><UserRound size={20}/><input required type="email" autoFocus autoComplete="email" inputMode="email" placeholder="Email address" aria-label="Email address" value={authEmail} onChange={e => setAuthEmail(e.target.value)}/></label>
              <label className="ns-auth-field"><LockKeyhole size={20}/><input required type={showAuthPassword ? 'text' : 'password'} minLength={authMode === 'register' ? 10 : 1} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} placeholder="Password" aria-label="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}/><button type="button" className="ns-auth-eye" aria-label={showAuthPassword ? 'Hide password' : 'Show password'} onClick={() => setShowAuthPassword(v => !v)}>{showAuthPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button></label>
              {authMode === 'register' && <p className="ns-auth-hint">Use at least 10 characters for your password.</p>}
              {authError && <div role="alert" className="ns-auth-error">{authError}</div>}
              {authNotice && <div role="status" className="ns-auth-notice">{authNotice}</div>}
              <button type="submit" disabled={authBusy} className="ns-auth-submit">{authBusy ? (authMode === 'register' ? 'Creating account…' : 'Signing in…') : authMode === 'register' ? 'Create account' : 'Login'}</button>
            </form>
            <p className="ns-auth-switch">{authMode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}<button type="button" onClick={() => {setAuthMode(authMode === 'register' ? 'login' : 'register');setAuthPassword('');setAuthError('');setAuthNotice('')}}>{authMode === 'register' ? 'Login' : 'Register'}</button></p>
            <div className="ns-auth-bottom"><span/>SECURE TRADING ACCESS<span/></div>
          </section>
          <div className="ns-auth-footer"><span className="ns-auth-footer-mark"><Activity size={19}/></span><strong>Northstar<span>FX</span></strong><small>Practice. Learn. Trade smarter.</small></div>
          <style>{`
            .ns-auth-backdrop{position:fixed;inset:0;z-index:2147483647;box-sizing:border-box;min-height:100dvh;width:100%;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:max(54px,env(safe-area-inset-top)) 18px max(28px,env(safe-area-inset-bottom));color:#f4f8ff;background-color:#06142c;background-image:radial-gradient(ellipse at 50% 12%,rgba(255,184,91,.38),transparent 34%),repeating-linear-gradient(0deg,transparent 0 35px,rgba(67,119,180,.18) 35px 37px,transparent 37px 72px),repeating-linear-gradient(90deg,transparent 0 42px,rgba(64,112,171,.13) 42px 44px,transparent 44px 86px),linear-gradient(90deg,#06152e,#0a2042 50%,#06152e);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
            .ns-auth-backdrop:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,5,18,.12),rgba(0,5,18,.48)),radial-gradient(ellipse,transparent 30%,rgba(0,5,18,.5))}
            .ns-auth-close{position:fixed;z-index:3;right:18px;top:18px;width:42px;height:42px;border:1px solid #31547d;border-radius:50%;display:grid;place-items:center;background:#071a35;color:#b8d8ff;cursor:pointer}
            .ns-auth-lamp{position:absolute;top:0;left:50%;transform:translateX(-50%);width:220px;height:85px;pointer-events:none;display:flex;justify-content:center}
            .ns-auth-lamp:before{content:"";position:absolute;top:0;width:100%;height:55px;background:linear-gradient(#020817,#18304b);clip-path:polygon(12% 0,88% 0,100% 100%,0 100%)}
            .ns-auth-lamp span{position:absolute;top:38px;width:78px;height:7px;background:#ffe1a0;box-shadow:0 0 12px 5px #ffbd69,0 0 55px 24px rgba(255,176,78,.28)}
            .ns-auth-card{position:relative;z-index:1;width:min(100%,440px);box-sizing:border-box;margin:auto 0;padding:30px;border:1px solid #2788ed;border-radius:18px;background:linear-gradient(145deg,rgba(30,48,78,.96),rgba(7,24,52,.98));box-shadow:0 24px 80px #0009,0 0 32px #0089ff26,inset 0 1px #ffffff20;backdrop-filter:blur(16px)}
            .ns-auth-brand{display:flex;align-items:center;justify-content:center;gap:9px;color:#dceaff;font-size:12px;font-weight:800;letter-spacing:2.5px}.ns-auth-brand b,.ns-auth-footer strong span{color:#00e4bd}
            .ns-auth-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;color:#00e6d0;background:#00d8cb1a;border:1px solid #00e2d155}
            .ns-auth-card h1{margin:18px 0 5px;text-align:center;font-size:clamp(40px,9vw,49px);line-height:1.08;font-weight:800;letter-spacing:-1.8px;background:linear-gradient(95deg,#16caff,#00f0b5);-webkit-background-clip:text;background-clip:text;color:transparent}
            .ns-auth-subtitle{margin:0 0 25px;text-align:center;color:#a8bddb;font-size:14px;line-height:1.55}.ns-auth-form{display:flex;flex-direction:column;gap:15px}
            .ns-auth-field{min-height:54px;box-sizing:border-box;display:flex;align-items:center;gap:13px;padding:0 17px;border:1px solid #63a3e180;border-radius:999px;background:#02112999;color:#00d9ed;transition:.18s}
            .ns-auth-field:focus-within{border-color:#00dcca;box-shadow:0 0 0 3px #00dcca20,0 0 20px #00b9ff20;background:#031631}
            .ns-auth-field input{width:100%;min-width:0;height:52px;padding:0;border:0;outline:0;background:transparent;color:#f5f8ff;font:inherit;font-size:16px}.ns-auth-field input::placeholder{color:#d0d9e8;opacity:.94}
            .ns-auth-eye{display:grid;place-items:center;padding:5px;border:0;background:transparent;color:#00d8ed;cursor:pointer}
            .ns-auth-hint{margin:-7px 4px 0;color:#9eb5d5;font-size:12px}.ns-auth-error,.ns-auth-notice{padding:11px 13px;border-radius:11px;font-size:13px;line-height:1.5}
            .ns-auth-error{border:1px solid #ff707d73;background:#73182b4d;color:#ffc1c8}.ns-auth-notice{border:1px solid #49a6ff66;background:#164e8547;color:#b9dcff}
            .ns-auth-submit{height:54px;margin-top:3px;border:0;border-radius:999px;background:linear-gradient(100deg,#10bdf3,#00e4a9);color:#03152d;font-size:17px;font-weight:750;cursor:pointer;box-shadow:0 8px 24px #00c9ca33;transition:transform .18s,filter .18s}
            .ns-auth-submit:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}.ns-auth-submit:disabled{opacity:.65;cursor:wait}
            .ns-auth-switch{margin:20px 0 0;text-align:center;color:#c5d2e6;font-size:14px}.ns-auth-switch button{padding:0;border:0;background:transparent;color:#00e5bd;font:inherit;font-weight:750;cursor:pointer}
            .ns-auth-bottom{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:24px;color:#00d9e8;font-size:11px;font-weight:800;letter-spacing:2px}.ns-auth-bottom span{height:1px;flex:1;background:linear-gradient(90deg,transparent,#00bde9)}.ns-auth-bottom span:last-child{background:linear-gradient(90deg,#00bde9,transparent)}
            .ns-auth-footer{position:relative;z-index:1;display:flex;align-items:center;gap:8px;margin-top:22px;color:#eaf4ff}.ns-auth-footer-mark{display:grid;place-items:center;width:28px;height:28px;border:2px solid #00e4bd;border-radius:8px;color:#00e4bd}.ns-auth-footer strong{font-size:18px}.ns-auth-footer small{margin-left:5px;color:#91a9ca;font-size:11px}
            @media(max-width:480px){.ns-auth-backdrop{justify-content:flex-start;padding-top:max(76px,env(safe-area-inset-top));padding-bottom:max(25px,env(safe-area-inset-bottom))}.ns-auth-card{padding:25px 20px 22px;border-radius:16px}.ns-auth-subtitle{margin-bottom:21px}.ns-auth-field{min-height:52px}.ns-auth-field input{height:50px}.ns-auth-footer{margin-top:18px;flex-wrap:wrap;justify-content:center}.ns-auth-footer small{flex-basis:100%;text-align:center;margin:0}}
            @media(prefers-reduced-motion:reduce){.ns-auth-field,.ns-auth-submit{transition:none}}
          `}</style>
        </div>,
        document.body,
      )}
    </div>
  )
}

function formatPrice(price: number, symbol: string) {
  const digits = symbol.endsWith('JPY') ? 3 : 5
  return price.toFixed(digits)
}

