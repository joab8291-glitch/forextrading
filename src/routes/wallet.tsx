import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/api'

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

  return <main className="min-h-dvh bg-background text-foreground">
    <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8"><Link to="/" className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16}/> Back to charts</Link><span className="font-mono text-xs font-bold tracking-widest">NORTHSTAR <span className="text-primary">FX</span></span></header>
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Cash wallet</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Manage your KES cash wallet and fund it securely through an M-Pesa STK Push.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-border bg-card p-6"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet size={15} className="text-primary"/> REAL CASH BALANCE · KES</div><div className="mt-5 font-mono text-4xl font-semibold">{balance === null ? '—' : balance.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 })}</div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Your cash wallet is separate from the $100,000 simulated paper-trading balance. Deposits do not execute live market trades.</p>{!signedIn && <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Sign in on the chart page to access your personal wallet.</p>}</section>
        <form onSubmit={deposit} className="space-y-5 rounded-xl border border-border bg-card p-6"><div><h2 className="text-lg font-semibold">Deposit with M-Pesa</h2><p className="mt-1 text-xs text-muted-foreground">KES 100–100,000 · Safaricom STK Push</p></div><label className="block text-xs text-muted-foreground">Amount (KES)<input type="number" min="100" max="100000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm text-foreground"/></label><label className="block text-xs text-muted-foreground">M-Pesa phone number<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07XXXXXXXX" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm text-foreground"/></label><button disabled={busy || Boolean(requestId)} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy?'Sending STK prompt…':requestId?'Awaiting confirmation…':'Request M-Pesa payment'} <ArrowUpRight size={15} className="ml-1 inline"/></button>{message && <p aria-live="polite" className="rounded-lg bg-muted p-3 text-xs leading-relaxed">{message}</p>}{requestId && <p className="text-xs text-muted-foreground">Waiting for Safaricom confirmation. This page checks status automatically.</p>}</form>
      </div>
    </div>
  </main>
}
