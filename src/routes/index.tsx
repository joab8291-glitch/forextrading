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

  const isUp = selected.change >= 0
  const units_n = Number(units) || 0
  const lots = units_n / 100000
  const positionValue = units_n * selected.price
  const quoteCurrency = selected.symbol.split('/')[1]
  const shown = activeView === 'open' ? openTrades : closedTrades
  const sideTone = side === 'buy' ? 'bg-up text-[#04120d] hover:brightness-110' : 'bg-down text-[#1c0508] hover:brightness-110'

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground lg:inline-flex">
              Practice balance <strong className="num font-semibold text-foreground">$100,000</strong>
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
            <p className="mt-2 text-sm text-muted-foreground">Indicative quote. Chart data comes from OANDA through TradingView.</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="num text-4xl font-semibold tracking-tight sm:text-5xl">{formatPrice(selected.price, selected.symbol)}</div>
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
                        <span className="num mt-0.5 block text-sm text-muted-foreground">{formatPrice(pair.price, pair.symbol)}</span>
                      </span>
                      <span className={`num inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-up' : 'text-down'}`}>
                        {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                        {up ? '+' : ''}{pair.change.toFixed(2)}%
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
              Practice environment. Quotes in the trade ticket are indicative samples.
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
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Entry price</dt><dd className="num font-medium">{formatPrice(selected.price, selected.symbol)}</dd></div>
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
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2147483647, width: '100vw', height: '100vh', minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: 'max(40px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))', background: '#0d1117', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-title"
          onKeyDown={(event) => { if (event.key === 'Escape') setAuthOpen(false) }}
        >
          <button type="button" onClick={() => setAuthOpen(false)} aria-label="Close sign-in dialog" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#8b949e', cursor: 'pointer' }}><X size={18}/></button>

          <div style={{ display: 'flex', width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#e6edf3', color: '#0d1117', marginTop: 8 }}><Activity size={36} strokeWidth={2.5}/></div>

          <h1 id="auth-title" style={{ margin: '24px 0 16px', fontSize: 24, fontWeight: 300, letterSpacing: '-0.3px', textAlign: 'center', color: '#e6edf3' }}>
            {authMode === 'register' ? 'Create your Northstar FX account' : 'Sign in to Northstar FX'}
          </h1>

          <form onSubmit={submitAuth} style={{ width: '100%', maxWidth: 340, boxSizing: 'border-box', padding: 16, borderRadius: 6, border: '1px solid #30363d', background: '#161b22' }}>
            {authMode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="auth-name" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 400, color: '#e6edf3' }}>Full name</label>
                <input id="auth-name" required minLength={2} maxLength={80} autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} className="gh-input" />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-email" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 400, color: '#e6edf3' }}>{authMode === 'register' ? 'Email address' : 'Username or email address'}</label>
              <input id="auth-email" required type="email" autoFocus autoComplete="email" inputMode="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="gh-input" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-password" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 400, color: '#e6edf3' }}>Password</label>
              <input id="auth-password" required type="password" minLength={authMode === 'register' ? 10 : 1} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="gh-input" />
              {authMode === 'register' && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#8b949e' }}>Use at least 10 characters.</p>}
            </div>
            {authError && (
              <div role="alert" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(248,81,73,0.4)', background: 'rgba(248,81,73,0.1)', color: '#ffa198', fontSize: 14, lineHeight: 1.5 }}>{authError}</div>
            )}
            {authNotice && (
              <div role="status" style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(56,139,253,0.4)', background: 'rgba(56,139,253,0.1)', color: '#9ecbff', fontSize: 14, lineHeight: 1.5 }}>{authNotice}</div>
            )}
            <button type="submit" disabled={authBusy} className="gh-button">
              {authBusy ? (authMode === 'register' ? 'Creating account…' : 'Signing in…') : authMode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div style={{ width: '100%', maxWidth: 340, boxSizing: 'border-box', marginTop: 16, padding: 16, borderRadius: 6, border: '1px solid #30363d', textAlign: 'center', fontSize: 14, color: '#e6edf3' }}>
            {authMode === 'register' ? 'Already have an account?' : 'New to Northstar FX?'}
            {' '}
            <button type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthPassword(''); setAuthError(''); setAuthNotice('') }} style={{ padding: 0, border: 0, background: 'none', color: '#4493f8', font: 'inherit', cursor: 'pointer' }} className="hover:underline">
              {authMode === 'register' ? 'Sign in' : 'Create an account'}
            </button>
          </div>

          <style>{`
            .gh-input { display: block; width: 100%; box-sizing: border-box; height: 40px; padding: 5px 12px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 16px; line-height: 20px; outline: none; transition: border-color .1s, box-shadow .1s; }
            .gh-input:focus { border-color: #1f6feb; box-shadow: inset 0 0 0 1px #1f6feb; }
            .gh-button { display: block; width: 100%; height: 40px; border-radius: 6px; border: 1px solid rgba(240,246,252,0.1); background: #238636; color: #fff; font-size: 16px; font-weight: 500; cursor: pointer; transition: background .1s; }
            .gh-button:hover:not(:disabled) { background: #2ea043; }
            .gh-button:focus-visible { outline: 2px solid #1f6feb; outline-offset: -2px; }
            .gh-button:disabled { cursor: not-allowed; opacity: .6; }
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

function pairPrice(symbol: string) {
  return PAIRS.find((pair) => pair.symbol === symbol)?.price ?? 0
}
