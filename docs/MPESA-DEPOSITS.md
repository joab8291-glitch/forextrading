# Northstar FX account and M-Pesa integration

Northstar FX owns its accounts and application data. The frontend calls the existing Webazi Daraja API at `https://webazi-digital-solutions.onrender.com`. PostgreSQL stores users, paper trades, deposits, wallet balances and the wallet ledger.

## Render environment

Set these on `joab8291-glitch/mpesa-daraja-server`:

```env
FOREX_AUTH_SECRET=<unique random secret, at least 32 characters>
FOREX_ALLOWED_ORIGINS=<exact published Forex app origin>
```

For local testing, add `,http://localhost:3000` to the allowed origins. Keep existing Daraja variables and `DATABASE_URL` unchanged. The frontend may set `VITE_MPESA_API_URL`; the default is the existing Render service. Never put Daraja credentials or the signing secret in frontend variables.

## Native accounts

- `POST /forex/auth/register` creates an account using name, email and password (10+ characters).
- `POST /forex/auth/login` signs in.
- `GET /forex/auth/me` validates the current session.
- `POST /forex/auth/logout` ends the browser session.
- Passwords are salted and hashed with Node.js scrypt. Signed bearer sessions expire after seven days. Login and registration are rate limited.

## Paper trades

`GET /forex/trades`, `POST /forex/trades` and `PATCH /forex/trades/:id/close` store practice positions in PostgreSQL, scoped to the authenticated account. These are simulations, not broker orders.

## M-Pesa deposits

The signed-in account token is used for `GET /forex/wallet`, `POST /forex/deposits/stk-push` and `GET /forex/deposits/:merchantRequestId`. The backend derives the user ID from the verified token; the browser cannot select another account. Safaricom callbacks validate the expected amount and phone and credit the wallet ledger exactly once.

The KES wallet is a cash ledger separate from the USD 100,000 practice balance. It is not connected to a live broker or real forex execution. Before taking deposits, configure the production origin, confirm Daraja credentials and callback routing, then test a controlled KES 100 STK payment and verify exactly one wallet credit. Also test cancellations, expired sessions and duplicate callbacks.
