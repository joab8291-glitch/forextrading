import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'forex-trade-site-gxnqgw8v',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_eNFPt-2SarezzukF7V2GysQ7_F30Whft',
  authRequired: false,
  auth: { mode: 'managed' },
})
