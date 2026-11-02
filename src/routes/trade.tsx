import { createFileRoute, Link } from '@tanstack/react-router'
import { ChartCandlestick } from 'lucide-react'
import { PageFrame } from '@/components/SiteHeader'

export const Route = createFileRoute('/trade')({ component: TradePage })

function TradePage() {
  return (
    <PageFrame title="Practice trading" description="Place simulated trades against indicative prices. Nothing here uses real money." width="max-w-3xl">
      <section className="panel px-6 py-12 text-center sm:px-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><ChartCandlestick size={26} /></div>
        <h2 className="mt-6 text-xl font-semibold">The trade ticket lives in the terminal</h2>
        <p className="mx-auto mt-3 max-w-lg leading-relaxed text-muted-foreground">Choose a market, pick Buy or Sell, set your size and optional stop loss and take profit, then place the trade next to the live chart.</p>
        <Link to="/" className="btn btn-primary mt-8">Open the terminal</Link>
      </section>
    </PageFrame>
  )
}
