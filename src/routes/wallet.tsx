import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/api'
import { PageFrame } from '@/components/SiteHeader'

export const Route = createFileRoute('/wallet')({ component: WalletPage })

function WalletPage() {
  const api = (import.meta.env.VITE_MPESA_API_URL || 'https://webazi-digital-solutions.onrender.com').replace(/\/$/, '')
  const [balance, setBalance] = useState<number | null>(null)
  const [amount, setAmount] = useState('1000')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let active = true
    const token = getToken()
    if (!token) return
    setSignedIn(true)
    fetch(api + '/forex/wallet', { headers: { Authorization: 'Bearer ' + token } })
      .then(async response => { if (!response.ok) throw new Error('Wallet unavailable'); return response.json() })
      .then(data => { if (active) setBalance(Number(data.balanceKes) || 0) })
      .catch(() => { if (active) setBalance(null) })
    return () => { active = false }
  }, [api])

  useEffect(() => {
    if (!requestId) return
    let active = true
    const check = async () => {
      try {
        const token = getToken()
        const response = await fetch(api + '/forex/deposits/' + encodeURIComponent(requestId), { headers: { Authorization: 'Bearer ' + (token || '') } })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        if (data.status === 'completed') {
          setMessage('Payment received. Receipt: ' + (data.receipt || 'confirmed'))
          setRequestId(null)
          const wallet = await fetch(api + '/forex/wallet', { headers: { Authorization: 'Bearer ' + (token || '') } })
          if (wallet.ok) { const result = await wallet.json(); setBalance(Number(result.balanceKes) || 0) }
          toast.success('Your cash wallet has been credited.')
        } else if (data.status === 'failed') {
          setMessage(data.error || 'M-Pesa payment was not completed.')
          setRequestId(null)
          toast.error('The deposit was not completed.')
        }
      } catch { /* Retry on the next poll. */ }
    }
    void check()
    const timer = window.setInterval(() => void check(), 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [requestId, api])

  async function deposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!getToken()) { toast.error('Sign in from the chart terminal before depositing.'); return }
    const value = Number(amount)
    if (!Number.isSafeInteger(value) || value < 100 || value > 100000) { toast.error('Enter a whole KES amount between 100 and 100,000.'); return }
    if (!phone.trim()) { toast.error('Enter the M-Pesa phone number.'); return }
    setBusy(true); setMessage('')
    try {
      const response = await fetch(api + '/forex/deposits/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (getToken() || '') },
        body: JSON.stringify({ amount: value, phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start M-Pesa payment.')
      setRequestId(data.merchantRequestId)
      setMessage(data.customerMessage || 'STK prompt sent. Enter your M-Pesa PIN to complete the deposit.')
      toast.success('M-Pesa prompt sent.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Deposit failed.') }
    finally { setBusy(false) }
  }

  return (
    <PageFrame title="Cash wallet" description="Add money to your KES wallet with an M-Pesa prompt on your phone. It is kept separate from your practice balance." width="max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="panel self-start" aria-label="Wallet balance">
          <div className="panel-head"><h2 className="text-base font-semibold">Balance</h2><Wallet size={18} className="text-muted-foreground" /></div>
          <div className="panel-body">
            <div className="text-sm text-muted-foreground">Available in KES</div>
            <div className="num mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{balance === null ? '—' : balance.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 })}</div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Deposits do not place live market trades. Your $100,000 practice balance is tracked separately.</p>
            {!signedIn && (
              <div className="mt-6 rounded-xl bg-background p-4 text-sm leading-relaxed text-secondary-foreground">
                Sign in from the terminal to see your wallet.
                <Link to="/" className="btn btn-primary btn-sm mt-4 w-full sm:w-auto">Go to terminal</Link>
              </div>
            )}
          </div>
        </section>

        <form onSubmit={deposit} className="panel" aria-label="Deposit with M-Pesa">
          <div className="panel-head"><h2 className="text-base font-semibold">Deposit with M-Pesa</h2><span className="text-sm text-muted-foreground">KES 100 to 100,000</span></div>
          <div className="panel-body space-y-6">
            <div>
              <label htmlFor="wallet-amount" className="field-label">Amount (KES)</label>
              <input id="wallet-amount" className="field num" type="number" min="100" max="100000" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                {['500', '1000', '5000', '10000'].map((preset) => (
                  <button key={preset} type="button" onClick={() => setAmount(preset)} className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${amount === preset ? 'border-primary/60 bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>{Number(preset).toLocaleString()}</button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="wallet-phone" className="field-label">M-Pesa phone number</label>
              <input id="wallet-phone" className="field num" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
              <p className="field-hint">You will get a prompt on this phone to enter your M-Pesa PIN.</p>
            </div>
            <button disabled={busy || Boolean(requestId)} className="btn btn-primary w-full">
              {busy ? 'Sending prompt…' : requestId ? 'Waiting for confirmation…' : 'Request M-Pesa prompt'}
              {!busy && !requestId && <ArrowUpRight size={17} />}
            </button>
            {message && <p aria-live="polite" className="rounded-xl bg-background p-4 text-sm leading-relaxed text-secondary-foreground">{message}</p>}
            {requestId && <p className="text-sm text-muted-foreground">Waiting for Safaricom to confirm. This page checks automatically.</p>}
          </div>
        </form>
      </div>
    </PageFrame>
  )
}
