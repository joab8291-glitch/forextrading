import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest, getToken } from '@/lib/api'
import type { SimulatedTradesRow } from '@/lib/db-types'
import { PageFrame } from '@/components/SiteHeader'

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
  return (
    <PageFrame title="Positions and history" description="Review the practice trades saved to your account and close any that are still open." width="max-w-6xl">
      <section className="panel overflow-hidden" aria-label="Paper trades">
        <div className="panel-head">
          <div className="segmented" role="tablist" aria-label="Position view">
            <button type="button" role="tab" aria-selected={view === 'open'} onClick={() => setView('open')}>Open positions</button>
            <button type="button" role="tab" aria-selected={view === 'closed'} onClick={() => setView('closed')}>History</button>
          </div>
          <button type="button" onClick={() => void load()} className="btn btn-outline btn-sm"><RefreshCw size={15} />Refresh</button>
        </div>
        {!signedIn ? (
          <div className="px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">Sign in to see your trades</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Your positions and history are private to your account.</p>
            <Link to="/" className="btn btn-primary mt-6">Go to terminal</Link>
          </div>
        ) : loading ? (
          <div className="px-6 py-16 text-center text-muted-foreground">Loading your trades…</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">{view === 'open' ? 'No open positions' : 'No closed trades yet'}</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Practice trades you place from the terminal will appear here.</p>
            <Link to="/" className="btn btn-outline mt-6">Open the terminal</Link>
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
                  <th scope="col" className="px-6 py-3.5 font-medium">{view === 'open' ? 'Stop loss and take profit' : 'Exit'}</th>
                  <th scope="col" className="px-6 py-3.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((trade) => (
                  <tr key={trade.id} className="transition-colors hover:bg-secondary/50">
                    <td className="px-6 py-4 font-semibold">{trade.symbol}</td>
                    <td className={`px-6 py-4 font-medium ${trade.side === 'buy' ? 'text-up' : 'text-down'}`}>{trade.side === 'buy' ? 'Long' : 'Short'}</td>
                    <td className="num px-6 py-4">{Number(trade.quantity).toLocaleString()}</td>
                    <td className="num px-6 py-4">{Number(trade.entryPrice).toFixed(trade.symbol.endsWith('JPY') ? 3 : 5)}</td>
                    <td className="num px-6 py-4 text-muted-foreground">{view === 'open' ? `Stop ${trade.stopLoss ?? '—'}, target ${trade.takeProfit ?? '—'}` : String(trade.exitPrice ?? '—')}</td>
                    <td className="px-6 py-4 text-right">{view === 'open' && <button type="button" onClick={() => void close(trade)} className="btn btn-outline btn-sm hover:border-down hover:text-down">Close</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageFrame>
  )
}
function indicativePrice(symbol:string){const sample:Record<string,number>={'EUR/USD':1.08426,'GBP/USD':1.26784,'USD/JPY':149.622,'AUD/USD':0.65218,'USD/CAD':1.36125,'USD/CHF':0.90144};return sample[symbol]??0}
