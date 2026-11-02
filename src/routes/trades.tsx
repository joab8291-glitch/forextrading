import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest, getToken } from '@/lib/api'
import type { SimulatedTradesRow } from '@/lib/db-types'

export const Route = createFileRoute('/trades')({ component: TradesPage })

function TradesPage() {
  const [trades, setTrades] = useState<SimulatedTradesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'open'|'closed'>('open')
  const [signedIn, setSignedIn] = useState(false)
  async function load() {
    if (!getToken()) { setSignedIn(false); setLoading(false); return }
    setSignedIn(true)
    try { const result = await apiRequest<{trades:SimulatedTradesRow[]}>('/forex/trades'); setTrades(result.trades) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load positions.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function close(trade: SimulatedTradesRow) {
    try {
      const response = await apiRequest('/forex/trades/' + encodeURIComponent(trade.id) + '/close', { method:'PATCH', body:JSON.stringify({ exitPrice: indicativePrice(trade.symbol) }) })
      void response
      await load()
      toast.success('Paper position closed.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not close position.') }
  }
  const rows = trades.filter(trade => trade.status === (view === 'open' ? 'open' : 'closed'))
  return <main className="min-h-dvh bg-background text-foreground"><header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8"><Link to="/" className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16}/> Back to charts</Link><span className="font-mono text-xs font-bold tracking-widest">NORTHSTAR <span className="text-primary">FX</span></span></header><div className="mx-auto max-w-6xl px-4 py-10 sm:px-8"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Trading account</p><h1 className="mt-2 text-3xl font-semibold">Positions & history</h1><p className="mt-2 text-sm text-muted-foreground">Review and manage your saved simulated trades.</p><section className="mt-8 overflow-hidden rounded-xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex rounded-lg bg-background p-1"><button onClick={()=>setView('open')} className={`rounded-md px-4 py-2 text-xs ${view==='open'?'bg-accent text-primary':'text-muted-foreground'}`}>Open positions</button><button onClick={()=>setView('closed')} className={`rounded-md px-4 py-2 text-xs ${view==='closed'?'bg-accent text-primary':'text-muted-foreground'}`}>History</button></div><button onClick={()=>void load()} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"><RefreshCw size={13}/>Refresh</button></div>{!signedIn?<div className="p-10 text-center"><h2 className="font-semibold">Sign in to view your trades</h2><p className="mt-2 text-xs text-muted-foreground">Your positions and history are private to your account.</p><Link to="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Go to sign in</Link></div>:loading?<div className="p-8 text-sm text-muted-foreground">Loading positions…</div>:rows.length===0?<div className="p-12 text-center"><h2 className="font-medium">{view==='open'?'No open positions':'No trade history yet'}</h2><p className="mt-2 text-xs text-muted-foreground">Practice trades you place from the chart will appear here.</p><Link to="/" className="mt-4 inline-block text-xs font-semibold text-primary">Return to charts</Link></div>:<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-background text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-4">Instrument</th><th className="p-4">Side</th><th className="p-4">Units</th><th className="p-4">Entry</th><th className="p-4">{view==='open'?'Risk levels':'Exit'}</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-border/60">{rows.map(trade=><tr key={trade.id}><td className="p-4 font-mono font-semibold">{trade.symbol}</td><td className={`p-4 font-semibold ${trade.side==='buy'?'text-primary':'text-destructive'}`}>{trade.side==='buy'?'Long':'Short'}</td><td className="p-4 font-mono">{Number(trade.quantity).toLocaleString()}</td><td className="p-4 font-mono">{Number(trade.entryPrice).toFixed(trade.symbol.endsWith('JPY')?3:5)}</td><td className="p-4 font-mono text-muted-foreground">{view==='open'?[`SL ${trade.stopLoss??'—'}`,`TP ${trade.takeProfit??'—'}`].join(' · '):String(trade.exitPrice??'—')}</td><td className="p-4 text-right">{view==='open'&&<button onClick={()=>void close(trade)} className="rounded-md border border-border px-3 py-1.5 text-[10px] hover:border-destructive hover:text-destructive">Close</button>}</td></tr>)}</tbody></table></div>}</section></div></main>
}
function indicativePrice(symbol:string){const sample:Record<string,number>={'EUR/USD':1.08426,'GBP/USD':1.26784,'USD/JPY':149.622,'AUD/USD':0.65218,'USD/CAD':1.36125,'USD/CHF':0.90144};return sample[symbol]??0}
