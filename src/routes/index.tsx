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
import { apiRequest, clearToken, getToken, setToken } from '@/lib/api'
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
        method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword, displayName: authName }),
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

  const [rightPanel, setRightPanel] = useState<'watchlist' | 'trade'>('watchlist')

  return (
    <main className="terminal-shell min-h-dvh overflow-hidden text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Activity size={18}/></div>
            <div className="min-w-0"><div className="font-mono text-[13px] font-bold tracking-[0.14em]">NORTHSTAR <span className="text-primary">FX</span></div><div className="hidden text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:block">Markets workspace</div></div>
            <div className="ml-3 hidden h-7 w-px bg-border lg:block"/>
            <nav className="hidden items-center gap-1 text-xs lg:flex">
              <a href="/" className="rounded-md bg-accent px-3 py-2 font-semibold text-primary">Chart</a>
              <a href="/trade" className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground">Trade</a>
              <a href="/trades" className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground">Positions</a>
              <a href="/wallet" className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground">Wallet</a>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground sm:inline">PAPER · $100,000</span>
            {authLoading ? <div className="h-8 w-20 animate-pulse rounded-md bg-muted"/> : user ? <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] hover:bg-accent"><span className="size-1.5 rounded-full bg-primary"/><span className="max-w-28 truncate">{user.email}</span><LogOut size={13}/></button> : <button onClick={signIn} className="rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"><LogIn size={13} className="mr-1 inline"/>Sign in</button>}
          </div>
        </div>
        <div className="flex h-9 items-center gap-5 overflow-x-auto border-t border-border/50 px-3 font-mono text-[10px] sm:px-5">
          <span className="shrink-0 font-sans text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Market overview</span>
          {PAIRS.map(pair => <button key={pair.symbol} onClick={() => setSelectedSymbol(pair.symbol)} className="flex shrink-0 items-center gap-2 hover:text-primary"><span className="text-muted-foreground">{pair.symbol}</span><span>{formatPrice(pair.price,pair.symbol)}</span><span className={pair.change>=0?'text-primary':'text-destructive'}>{pair.change>0?'+':''}{pair.change.toFixed(2)}%</span></button>)}
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-92px)]">
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-border/70 bg-sidebar py-3 md:flex">
          <RailButton active label="Chart" onClick={() => window.location.assign('/')}><BarChart3 size={18}/></RailButton>
          <RailButton label="Trade" onClick={() => window.location.assign('/trade')}><Activity size={18}/></RailButton>
          <RailButton label="Positions" onClick={() => window.location.assign('/trades')}><Wallet size={18}/></RailButton>
          <RailButton label="Wallet" onClick={() => window.location.assign('/wallet')}><ArrowUpRight size={18}/></RailButton>
        </aside>

        <div className="grid min-w-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[10px] font-bold text-primary">{selected.symbol.slice(0,3)}</div>
                <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="font-mono text-base font-bold">{selected.symbol}</h1><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">FOREX</span></div><div className="text-[10px] text-muted-foreground">Spot market · indicative quote</div></div>
                <div className="ml-2 hidden sm:block"><div className="font-mono text-lg font-semibold">{formatPrice(selected.price,selected.symbol)}</div><div className={`font-mono text-[10px] ${selected.change>=0?'text-primary':'text-destructive'}`}>{selected.change>=0?'+':''}{selected.change.toFixed(2)}% today</div></div>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-card p-1" aria-label="Chart timeframe">{INTERVALS.map(item=><button key={item.value} onClick={()=>setInterval(item.value)} className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] ${interval===item.value?'bg-accent text-primary':'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>
              <div className="hidden items-center gap-3 text-[10px] text-muted-foreground sm:flex"><span>High <b className="font-mono text-foreground">{selected.high}</b></span><span>Low <b className="font-mono text-foreground">{selected.low}</b></span></div>
            </div>
            <div className="chart-grid h-[calc(100dvh-188px)] min-h-[480px] bg-background xl:h-[calc(100dvh-188px)]">
              <iframe key={chartUrl} title={`TradingView chart for ${selected.symbol}`} src={chartUrl} className="h-full w-full border-0" loading="eager" allow="clipboard-write"/>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2 text-[9px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary"/>Chart powered by TradingView</span><span>Practice environment · Quotes shown in the trade ticket are indicative samples</span></div>
          </section>

          <aside className="flex min-w-0 flex-col border-t border-border/70 bg-card xl:border-l xl:border-t-0">
            <div className="flex h-12 shrink-0 items-center border-b border-border/70 px-2">
              <button onClick={()=>setRightPanel('watchlist')} className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold ${rightPanel==='watchlist'?'bg-accent text-primary':'text-muted-foreground hover:text-foreground'}`}>Watchlist</button>
              <button onClick={()=>setRightPanel('trade')} className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold ${rightPanel==='trade'?'bg-accent text-primary':'text-muted-foreground hover:text-foreground'}`}>Trade ticket</button>
            </div>
            {rightPanel==='watchlist' ? <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-b border-border/60 px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground"><span>Symbol</span><span>Last</span><span>Change</span></div>
              {PAIRS.map(pair=><button key={pair.symbol} onClick={()=>setSelectedSymbol(pair.symbol)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border/50 px-3 py-3 text-left transition hover:bg-accent/50 ${selected.symbol===pair.symbol?'bg-primary/[0.07]':''}`}><span className="min-w-0"><span className="block font-mono text-[11px] font-semibold">{pair.symbol}</span><span className="block text-[9px] text-muted-foreground">Forex</span></span><span className="font-mono text-[10px]">{formatPrice(pair.price,pair.symbol)}</span><span className={`text-right font-mono text-[10px] ${pair.change>=0?'text-primary':'text-destructive'}`}>{pair.change>0?'+':''}{pair.change.toFixed(2)}%</span></button>)}
              <div className="p-3"><a href="/trade" className="block rounded-lg border border-border px-3 py-2.5 text-center text-[10px] font-semibold hover:bg-accent">Open practice trading <ArrowUpRight size={13} className="ml-1 inline"/></a></div>
              <div className="mx-3 rounded-lg bg-background p-3 text-[9px] leading-relaxed text-muted-foreground">Market quotes in this watchlist are sample display values and may differ from the embedded TradingView chart.</div>
            </div> : <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4"><p className="text-[9px] font-semibold uppercase tracking-widest text-primary">Paper trading</p><h2 className="mt-1 text-base font-semibold">Practice order</h2><p className="mt-1 text-[10px] text-muted-foreground">No real orders or broker execution.</p></div>
              <div className="mb-3 flex rounded-lg bg-background p-1"><button type="button" onClick={()=>setSide('buy')} className={`flex-1 rounded-md py-2 text-[10px] font-semibold ${side==='buy'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Buy / Long</button><button type="button" onClick={()=>setSide('sell')} className={`flex-1 rounded-md py-2 text-[10px] font-semibold ${side==='sell'?'bg-destructive/15 text-destructive':'text-muted-foreground'}`}>Sell / Short</button></div>
              <form onSubmit={placePaperTrade} className="space-y-3">
                <label className="block text-[10px] text-muted-foreground">Market pair<select value={selectedSymbol} onChange={e=>setSelectedSymbol(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2.5 font-mono text-xs text-foreground">{PAIRS.map(pair=><option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}</select></label>
                <label className="block text-[10px] text-muted-foreground">Position size · units<input type="number" min="1000" max="1000000" step="1000" value={units} onChange={e=>setUnits(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2.5 font-mono text-xs text-foreground"/></label>
                <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-muted-foreground">Stop loss<input type="number" step="any" value={stopLoss} onChange={e=>setStopLoss(e.target.value)} placeholder="Optional" className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2 font-mono text-[10px] text-foreground"/></label><label className="text-[10px] text-muted-foreground">Take profit<input type="number" step="any" value={takeProfit} onChange={e=>setTakeProfit(e.target.value)} placeholder="Optional" className="mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2 font-mono text-[10px] text-foreground"/></label></div>
                <div className="rounded-md border border-border bg-background p-2.5"><div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Indicative entry</span><b className="font-mono">{formatPrice(selected.price,selected.symbol)}</b></div><div className="mt-1 flex justify-between text-[10px]"><span className="text-muted-foreground">Order type</span><span>Market · simulated</span></div></div>
                <button type="submit" disabled={savingTrade} className={`w-full rounded-md py-3 text-[11px] font-bold disabled:opacity-50 ${side==='buy'?'bg-primary text-primary-foreground':'bg-destructive text-destructive-foreground'}`}>{savingTrade?'Saving…':user?`${side==='buy'?'Buy':'Sell'} ${selected.symbol}`:'Sign in to practise'}</button>
              </form>
            </div>}
          </aside>
        </div>
      </div>

      {authOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-widest text-primary">Northstar FX account</p><h2 id="auth-title" className="mt-1 text-xl font-semibold">{authMode==='register'?'Create your account':'Welcome back'}</h2></div><button onClick={()=>setAuthOpen(false)} aria-label="Close" className="text-muted-foreground">✕</button></div><form onSubmit={submitAuth} className="space-y-3">{authMode==='register'&&<label className="block text-xs text-muted-foreground">Full name<input required minLength={2} maxLength={80} value={authName} onChange={e=>setAuthName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>}<label className="block text-xs text-muted-foreground">Email<input required type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label><label className="block text-xs text-muted-foreground">Password<input required type="password" minLength={authMode==='register'?10:1} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label><button disabled={authBusy} className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{authBusy?'Please wait…':authMode==='register'?'Create account':'Sign in'}</button></form><p className="mt-4 text-center text-xs text-muted-foreground">{authMode==='register'?'Already registered?':'New to Northstar FX?'} <button onClick={()=>setAuthMode(authMode==='register'?'login':'register')} className="font-semibold text-primary">{authMode==='register'?'Sign in':'Create account'}</button></p></div></div>}
    </main>
  )
}
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
