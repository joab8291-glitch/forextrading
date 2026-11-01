# Forex M-Pesa deposits

The Forex app's cash wallet uses the existing Webazi Daraja service at
`https://webazi-digital-solutions.onrender.com`. It is a separate ledger from
Webazi Airtime / USSD transactions.

## Runtime configuration

### Forex app deployment (Blink project)

The app defaults to the existing service URL `https://webazi-digital-solutions.onrender.com`. Set `VITE_MPESA_API_URL` only if you later move the payment API to another host. Do not put Daraja consumer credentials or any server API secret in the frontend.

### Existing Render service: Webazi Digital Solutions

On the existing Render web service backed by
`joab8291-glitch/mpesa-daraja-server`, configure:

```env
BLINK_PROJECT_ID=forex-trade-site-gxnqgw8v
FOREX_ALLOWED_ORIGINS=https://forex-trade-site-gxnqgw8v.blinkusercontent.com  # protected preview origin
```

For local development, append `,http://localhost:3000` to
`FOREX_ALLOWED_ORIGINS`. The Blink project URL currently resolves to a protected preview at
`https://forex-trade-site-gxnqgw8v.blinkusercontent.com`. That preview origin is
allowlisted now. After you publish the app from the Blink dashboard, add the
exact public production origin to this comma-separated variable as well. Use
the exact browser origin including scheme and custom port; do not add a path or
trailing slash.

Keep the existing Daraja variables unchanged:
`DATABASE_URL`, `MPESA_BASE_URL`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`,
`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, and
`MPESA_CALLBACK_URL`. The callback URL must continue pointing to the
existing `/callback/stk-callback` endpoint registered with Safaricom.

The existing Render build command `npm install` installs the added Blink SDK
dependency. The server automatically creates the isolated Forex tables in the
configured PostgreSQL database at first use.

## Payment flow

1. The signed-in Blink user obtains a short-lived access token from the SDK.
2. The browser calls `POST /forex/deposits/stk-push` with that bearer token,
   a Kenyan M-Pesa number and a whole-KES amount (KES 100–100,000).
3. The Daraja server verifies the token with the configured Blink project,
   derives the user ID from the verified session, creates a pending deposit,
   and sends the Safaricom STK Push.
4. Safaricom posts the result to the existing callback URL. The callback handler
   first checks the Forex deposit table. A matching Forex payment is validated
   against the expected amount and phone, then credited exactly once through a
   database transaction and unique wallet-ledger constraints.
5. The browser polls the authenticated deposit-status endpoint and refreshes
   the wallet after a confirmed payment.

Forex wallet routes:
- `GET /forex/wallet`
- `POST /forex/deposits/stk-push`
- `GET /forex/deposits/:merchantRequestId`

All three require a valid Blink bearer token. CORS and the Forex origin allowlist
are additional browser controls, not substitutes for authentication.

## Important product boundary

This adds a KES cash-deposit wallet only. The current Northstar FX positions
remain simulated paper trades and the displayed USD 100,000 practice balance
has no cash value. Deposited KES is not automatically converted to USD, used to
fund simulated positions, or connected to a live broker. Do not describe the
platform as real-money forex execution until a regulated broker, trading API,
order execution, withdrawals, reconciliation and compliance controls are
implemented separately.

## Production verification checklist

Before accepting customer deposits:
- Set the exact Forex production origin in Render.
- Confirm the existing Render service has working PostgreSQL and production
  Daraja credentials, and that Safaricom's callback URL is correct.
- Confirm the existing Safaricom callback IP allowlist still matches the
  production callback traffic.
- Run one controlled KES 100 deposit from a test account; verify the STK prompt,
  successful callback, one wallet credit, and the matching M-Pesa receipt.
- Repeat the callback in a controlled test to verify no second credit occurs.
- Test user cancellation, wrong PIN, network interruption and a different
  user's attempt to read the deposit status.
