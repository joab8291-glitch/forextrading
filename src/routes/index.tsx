import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { blink } from '@/blink/client'
import type { SimulatedTradesRow } from '@/lib/db-types'

const PAIRS = [
  { symbol: 'EUR/USD', tvSymbol: 'FX:EURUSD', price: 1.08426, change: 0.18, spread: '0.1', high: '1.08641', low: '1.08182' },
  { symbol: 'GBP/USD', tvSymbol: 'FX:GBPUSD', price: 1.26784, change: -0.12, spread: '0.2', high: '1.27120', low: '1.26433' },
  { symbol: 'USD/JPY', tvSymbol: 'FX:USDJPY', price: 149.622, change: 0.31, spread: '0.2', high: '149.881', low: '149.104' },
  { symbol: 'AUD/USD', tvSymbol: 'FX:AUDUSD', price: 0.65218, change: 0.07, spread: '0.2', high: '0.65401', low: '0.64927' },
  { symbol: 'USD/CAD', tvSymbol: 'FX:USDCAD', price: 1.36125, change: -0.08, spread: '0.3', high: '1.36402', low: '1.35890' },
  { symbol: 'USD/CHF', tvSymbol: 'FX:USDCHF', price: 0.90144, change: 0.04, spread: '0.3', high: '0.90311', low: '0.89922' },
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
  const [savingTrade, setSavingTrade] = useState(false)
  const [activeView, setActiveView] = useState<'open' | 'history'>('open')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [depositPhone, setDepositPhone] = useState('')
  const [depositBusy, setDepositBusy] = useState(false)
  const [depositRequestId, setDepositRequestId] = useState<string | null>(null)
  const [depositMessage, setDepositMessage] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const mpesaApiBase = (import.meta.env.VITE_MPESA_API_URL || '').replace(/\\/$/, '')

  const selected = PAIRS.find((pair) => pair.symbol === selectedSymbol) ?? PAIRS[0]
  const { data: trades = [], isLoading: tradesLoading, refetch: refreshTrades, isError: tradesError, error: tradesLoadError } = useQuery({
    queryKey: ['simulated_trades', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return []
      return blink.db.table<SimulatedTradesRow>('simulated_trades').list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      })
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
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (!state.isLoading) setAuthLoading(false)
    })
    return unsubscribe
  }, [])

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
        const token = await blink.auth.getValidToken()
        const response = await fetch(`${mpesaApiBase}/forex/wallet`, {
          headers: { Authorization: `Bearer ${token}` },
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
        const token = await blink.auth.getValidToken()
        const response = await fetch(`${mpesaApiBase}/forex/deposits/${encodeURIComponent(depositRequestId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        if (data.status === 'completed') {
          setDepositMessage(`Payment received. Receipt: ${data.receipt || 'confirmed'}`)
          setDepositRequestId(null)
          const walletResponse = await fetch(`${mpesaApiBase}/forex/wallet`, {
            headers: { Authorization: `Bearer ${token}` },
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
      toast.error('M-Pesa deposits are not configured yet. Set VITE_MPESA_API_URL in the Forex deployment.')
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
      const token = await blink.auth.getValidToken()
      const response = await fetch(`${mpesaApiBase}/forex/deposits/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    blink.auth.login(window.location.href)
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
      await blink.db.table<SimulatedTradesRow>('simulated_trades').create({
        userId: user.id,
        symbol: selected.symbol,
        side,
        quantity,
        entryPrice: selected.price,
        stopLoss: stop,
        takeProfit: target,
        status: 'open',
        exitPrice: null,
      })
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
      await blink.db.table<SimulatedTradesRow>('simulated_trades').update(trade.id, {
        status: 'closed',
        exitPrice: pairPrice(trade.symbol),
      })
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

  return (
    <main className="terminal-shell min-h-dvh text-foreground">
      <div className="flex min-h-dvh">
        <aside className="hidden w-[72px] shrink-0 flex-col items-center border-r border-border/70 bg-sidebar py-5 lg:flex">
          <button aria-label="Northstar home" onClick={() => goTo('market')} className="mb-9 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition hover:scale-105 active:scale-95">
            <Activity size={20} strokeWidth={2.5} />
          </button>
          <nav aria-label="Main navigation" className="flex flex-1 flex-col items-center gap-3">
            <RailButton active label="Markets" onClick={() => goTo('market')}><BarChart3 size={19} /></RailButton>
            <RailButton label="Watchlist" onClick={() => goTo('watchlist')}><SlidersHorizontal size={19} /></RailButton>
            <RailButton label="Positions" onClick={() => goTo('positions')}><Wallet size={19} /></RailButton>
          </nav>
          <RailButton label="Help" onClick={() => toast('This is a paper-trading demo; no real orders or funds are handled.')}><CircleHelp size={19} /></RailButton>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl">
            <div className="flex h-[68px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
              <div className="flex items-center gap-3">
                <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen((open) => !open)}>
                  <Menu size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary lg:hidden"><Activity size={18} /></div>
                  <div>
                    <div className="font-mono text-[13px] font-semibold tracking-[0.16em] text-foreground">NORTHSTAR <span className="text-primary">FX</span></div>
                    <div className="hidden text-[10px] uppercase tracking-[0.17em] text-muted-foreground sm:block">Market terminal</div>
                  </div>
                </div>
                <div className="ml-5 hidden h-8 w-px bg-border md:block" />
                <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-primary" /> TradingView charts</div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => goTo('watchlist')} className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground xl:flex"><Search size={14} /><span>Browse pairs</span></button>
                <button aria-label="Notifications" onClick={() => toast('You are all caught up.')} className="hidden rounded-lg border border-border bg-card p-2.5 text-muted-foreground transition hover:text-foreground sm:block"><Bell size={16} /></button>
                {authLoading ? (
                  <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
                ) : user ? (
                  <button onClick={() => void blink.auth.logout()} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{(user.email?.[0] ?? 'T').toUpperCase()}</span>
                    <span className="hidden max-w-28 truncate sm:block">{user.email ?? 'Trader account'}</span><LogOut size={14} className="text-muted-foreground" />
                  </button>
                ) : (
                  <button onClick={signIn} className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-105 active:scale-[0.98]"><LogIn size={15} /> Sign in</button>
                )}
              </div>
            </div>
            <div className="flex h-10 items-center gap-6 overflow-x-auto border-t border-border/50 px-4 font-mono text-[11px] sm:px-6 xl:px-8">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">FX overview</span>
              {PAIRS.slice(0, 4).map((pair) => <button key={pair.symbol} onClick={() => setSelectedSymbol(pair.symbol)} className="flex shrink-0 items-center gap-2 transition hover:text-primary"><span className="text-muted-foreground">{pair.symbol}</span><span className="text-foreground">{formatPrice(pair.price, pair.symbol)}</span><span className={pair.change >= 0 ? 'text-primary' : 'text-destructive'}>{pair.change > 0 ? '+' : ''}{pair.change.toFixed(2)}%</span></button>)}
            </div>
          </header>

          {mobileNavOpen && <div className="fixed inset-x-0 top-[108px] z-40 border-b border-border bg-card p-3 shadow-lg lg:hidden"><div className="grid grid-cols-3 gap-2"><MobileNavButton onClick={() => goTo('market')}>Markets</MobileNavButton><MobileNavButton onClick={() => goTo('watchlist')}>Watchlist</MobileNavButton><MobileNavButton onClick={() => goTo('positions')}>Positions</MobileNavButton></div></div>}

          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4" id="market">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary"><span className="size-1.5 rounded-full bg-primary" /> Demo environment</div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Forex markets</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">A clean space to explore the market and practise your setups.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2.5 shadow-sm">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet size={16} /></div>
                <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Virtual buying power</div><div className="font-mono text-sm font-semibold text-foreground">$100,000.00 <span className="text-[10px] font-normal text-muted-foreground">PAPER</span></div></div>
              </div>
            </div>

            <section className="mb-5 grid gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] sm:p-5">
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Wallet size={14} /> Real cash wallet · KES</div>
                <div className="mt-2 font-mono text-3xl font-semibold tracking-tight">{walletBalance === null ? '—' : `KES ${walletBalance.toLocaleString('en-KE')}`}</div>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">Deposits are recorded separately from practice capital. Your $100,000 paper balance and simulated trades are not real-money trading.</p>
                {depositMessage && <p aria-live="polite" className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground">{depositMessage}</p>}
                {depositRequestId && <p className="mt-2 text-[10px] text-muted-foreground">Waiting for M-Pesa confirmation… This panel checks payment status automatically.</p>}
              </div>
              <form onSubmit={startDeposit} className="grid content-center gap-3 rounded-xl border border-border/70 bg-background/65 p-3.5 sm:p-4">
                <div><h2 className="text-sm font-semibold">Deposit with M-Pesa</h2><p className="mt-0.5 text-[11px] text-muted-foreground">KES 100–100,000 · Safaricom STK Push</p></div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="text-[10px] font-medium text-muted-foreground">Amount (KES)
                    <input type="number" min="100" max="100000" step="1" required value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary/70" />
                  </label>
                  <label className="text-[10px] font-medium text-muted-foreground">M-Pesa number
                    <input type="tel" required value={depositPhone} onChange={(event) => setDepositPhone(event.target.value)} placeholder="07XXXXXXXX" className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary/70" />
                  </label>
                </div>
                <button type="submit" disabled={depositBusy || Boolean(depositRequestId) || !user || !mpesaApiBase} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{depositBusy ? 'Sending STK prompt…' : depositRequestId ? 'Awaiting M-Pesa confirmation…' : 'Deposit via M-Pesa'}<ArrowUpRight size={15} /></button>
                {!mpesaApiBase && <p className="text-[10px] text-destructive">Payment API URL is not configured in this deployment.</p>}
                {!user && <p className="text-[10px] text-muted-foreground">Sign in to deposit into your own wallet.</p>}
              </form>
            </section>

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Market" value="Forex" sub="Global currency pairs" icon={<Activity size={15} />} />
              <Metric label="Practice capital" value="$100,000" sub="Virtual · no cash value" icon={<Wallet size={15} />} />
              <Metric label="Open positions" value={user ? String(openTrades.length).padStart(2, '0') : '—'} sub={user ? 'Your paper trades' : 'Sign in to save trades'} icon={<BarChart3 size={15} />} />
              <Metric label="Session" value="24 / 5" sub="Market hours vary by venue" icon={<Clock3 size={15} />} />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_332px]">
              <section className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 font-mono text-[11px] font-bold text-primary">{selected.symbol.slice(0, 3)}</div>
                    <div><div className="flex items-center gap-2"><h2 className="font-mono text-base font-semibold">{selected.symbol}</h2><ChevronDown size={14} className="text-muted-foreground" /></div><div className="mt-0.5 text-[11px] text-muted-foreground">{selected.symbol.split('/').join(' · ')} <span className="mx-1.5">/</span> Forex</div></div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="text-right"><div className="font-mono text-lg font-semibold tracking-tight">{formatPrice(selected.price, selected.symbol)}</div><div className={`font-mono text-[11px] ${selected.change >= 0 ? 'text-primary' : 'text-destructive'}`}>{selected.change >= 0 ? '+' : ''}{selected.change.toFixed(2)}% today</div></div>
                    <div className="hidden h-8 w-px bg-border sm:block" />
                    <div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spread</div><div className="font-mono text-xs">{selected.spread} pips</div></div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-1 rounded-lg bg-background/75 p-1" aria-label="Chart timeframe">{INTERVALS.map((item) => <button key={item.value} onClick={() => setInterval(item.value)} className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] transition ${interval === item.value ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><span>High <b className="ml-1 font-mono font-medium text-foreground">{selected.high}</b></span><span className="text-border">/</span><span>Low <b className="ml-1 font-mono font-medium text-foreground">{selected.low}</b></span><button aria-label="Chart options" className="ml-1 rounded-md p-1.5 hover:bg-accent" onClick={() => toast('Chart controls are provided by TradingView.')}><SlidersHorizontal size={14} /></button></div>
                </div>
                <div className="chart-grid relative h-[350px] bg-background sm:h-[430px] xl:h-[480px]">
                  <iframe key={chartUrl} title={`TradingView chart for ${selected.symbol}`} src={chartUrl} className="relative z-10 h-full w-full border-0" loading="lazy" allow="clipboard-write" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground sm:px-5"><span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> Chart hosted by TradingView</span><span>Quotes in the ticket are sample-only and may differ from chart data.</span></div>
              </section>

              <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-md sm:p-5">
                <div className="mb-5 flex items-start justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Practice order</div><h2 className="mt-1 text-lg font-semibold">Trade ticket</h2></div><button onClick={() => toast('Orders are simulated. No broker is connected.')} aria-label="Order information" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><CircleHelp size={16} /></button></div>
                <div className="mb-4 flex rounded-xl bg-background p-1">
                  <button type="button" onClick={() => setSide('buy')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${side === 'buy' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><ArrowUpRight size={15} /> Buy / Long</button>
                  <button type="button" onClick={() => setSide('sell')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${side === 'sell' ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground hover:text-foreground'}`}><ArrowDownRight size={15} /> Sell / Short</button>
                </div>
                <form onSubmit={placePaperTrade} className="space-y-4">
                  <div><label htmlFor="pair" className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Currency pair</label><div className="relative"><select id="pair" value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)} className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-3 pr-9 font-mono text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10">{PAIRS.map((pair) => <option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div></div>
                  <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="units" className="text-[11px] font-medium text-muted-foreground">Position size</label><span className="text-[10px] text-muted-foreground">Units</span></div><input id="units" type="number" min="1000" max="1000000" step="1000" value={units} onChange={(event) => setUnits(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/10" /></div>
                  <div className="grid grid-cols-2 gap-3"><div><label htmlFor="stop" className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Stop loss <span className="font-normal">(optional)</span></label><input id="stop" type="number" step="any" placeholder="—" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary/70" /></div><div><label htmlFor="target" className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Take profit <span className="font-normal">(optional)</span></label><input id="target" type="number" step="any" placeholder="—" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary/70" /></div></div>
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3.5"><div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Indicative entry</span><span className="font-mono font-medium">{formatPrice(selected.price, selected.symbol)}</span></div><div className="mt-2 flex justify-between text-[11px]"><span className="text-muted-foreground">Order type</span><span className="text-foreground">Market · simulated</span></div></div>
                  <button type="submit" disabled={savingTrade} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 ${side === 'buy' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>{savingTrade ? 'Saving paper order…' : user ? `${side === 'buy' ? 'Buy' : 'Sell'} ${selected.symbol}` : 'Sign in to practise'}<ArrowUpRight size={16} /></button>
                </form>
                <div className="mt-4 flex gap-2 rounded-lg bg-primary/5 p-3 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" /><p>This creates a saved paper position only. No real order, deposit, withdrawal, or cash balance is connected.</p></div>
              </section>
            </div>

            <section id="watchlist" className="mt-5 grid scroll-mt-32 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Watchlist</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Major pairs · indicative sample quotes</p></div><button aria-label="Watchlist settings" onClick={() => toast('Showing the default major-pairs watchlist.')} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><SlidersHorizontal size={15} /></button></div>
                <div className="divide-y divide-border/60">{PAIRS.map((pair) => <button key={pair.symbol} onClick={() => { setSelectedSymbol(pair.symbol); goTo('market') }} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-accent/45 sm:grid-cols-[minmax(0,1fr)_100px_90px_70px] sm:px-5 ${selected.symbol === pair.symbol ? 'bg-primary/[0.035]' : ''}`}><span className="flex min-w-0 items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background font-mono text-[9px] font-semibold text-muted-foreground">{pair.symbol.slice(0, 3)}</span><span className="min-w-0"><span className="block truncate font-mono text-xs font-semibold">{pair.symbol}</span><span className="block text-[10px] text-muted-foreground">Spot FX</span></span></span><span className="text-right font-mono text-xs">{formatPrice(pair.price, pair.symbol)}</span><span className={`text-right font-mono text-[11px] ${pair.change >= 0 ? 'text-primary' : 'text-destructive'}`}>{pair.change > 0 ? '+' : ''}{pair.change.toFixed(2)}%</span><span className="hidden justify-end sm:flex">{pair.change >= 0 ? <ArrowUpRight size={15} className="text-primary" /> : <ArrowDownRight size={15} className="text-destructive" />}</span></button>)}</div>
                <div className="border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground sm:px-5">Sample prices are for interface demonstration only.</div>
              </div>

              <div id="positions" className="scroll-mt-32 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Your practice trades</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Positions are saved to your signed-in account</p></div><div className="flex rounded-lg bg-background p-1"><button onClick={() => setActiveView('open')} className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium ${activeView === 'open' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}>Open {user && <span className="ml-1 font-mono">{openTrades.length}</span>}</button><button onClick={() => setActiveView('history')} className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium ${activeView === 'history' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}>History</button></div></div>
                {!user ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Wallet size={19} /></div><h3 className="text-sm font-medium">Sign in to save your practice trades</h3><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Your paper positions and trade history will be private to your account.</p><button onClick={signIn} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-accent">Sign in with email</button></div> : tradesLoading ? <div className="space-y-3 p-5"><div className="h-10 animate-pulse rounded-lg bg-muted" /><div className="h-10 animate-pulse rounded-lg bg-muted" /></div> : (activeView === 'open' ? openTrades : closedTrades).length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center"><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent text-primary"><BarChart3 size={19} /></div><h3 className="text-sm font-medium">{activeView === 'open' ? 'No open practice positions' : 'No closed trades yet'}</h3><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Select a pair and place a simulated order to see it here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left"><thead className="bg-background/55 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 font-medium sm:px-5">Pair / side</th><th className="px-3 py-3 font-medium">Size</th><th className="px-3 py-3 font-medium">Entry</th><th className="px-3 py-3 font-medium">{activeView === 'open' ? 'Risk levels' : 'Exit'}</th><th className="px-4 py-3 text-right font-medium sm:px-5">Action</th></tr></thead><tbody className="divide-y divide-border/60">{(activeView === 'open' ? openTrades : closedTrades).map((trade) => <tr key={trade.id} className="text-xs"><td className="px-4 py-3.5 sm:px-5"><div className="font-mono font-semibold">{trade.symbol}</div><div className={`mt-1 text-[10px] capitalize ${trade.side === 'buy' ? 'text-primary' : 'text-destructive'}`}>{trade.side === 'buy' ? 'Long' : 'Short'} · paper</div></td><td className="px-3 py-3.5 font-mono">{Number(trade.quantity).toLocaleString()}</td><td className="px-3 py-3.5 font-mono">{formatPrice(Number(trade.entryPrice), trade.symbol)}</td><td className="px-3 py-3.5 font-mono text-muted-foreground">{activeView === 'open' ? <span>{trade.stopLoss ? `SL ${formatPrice(Number(trade.stopLoss), trade.symbol)}` : '—'}{trade.takeProfit ? ` · TP ${formatPrice(Number(trade.takeProfit), trade.symbol)}` : ''}</span> : formatPrice(Number(trade.exitPrice), trade.symbol)}</td><td className="px-4 py-3.5 text-right sm:px-5">{activeView === 'open' && <button onClick={() => void closePaperTrade(trade)} className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition hover:border-destructive/50 hover:text-destructive">Close</button>}</td></tr>)}</tbody></table></div>}
              </div>
            </section>

            <footer className="mt-6 flex flex-col gap-2 border-t border-border/60 py-4 text-[10px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>Northstar FX is a paper-trading interface for practice and education. It is not a brokerage or investment service.</p><span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary" /> No real funds or orders are handled</span></footer>
          </div>
        </div>
      </div>
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
