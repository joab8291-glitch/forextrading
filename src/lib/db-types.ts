// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type SimulatedTradesRow = {
  id: string
  userId: string
  symbol: string
  side: string
  quantity: number | string
  entryPrice: number | string
  stopLoss: number | string | null
  takeProfit: number | string | null
  status: string
  exitPrice: number | string | null
  createdAt: string
}
