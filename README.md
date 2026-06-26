# WealthOS — your private money command center 💸

A state-of-the-art, **installable iPhone app** (Progressive Web App) for bills,
budgeting, savings goals, investing, and building **perfect credit** — built to
take you to your first million. Everything runs **100% locally on your phone**;
no account, no server, no data ever leaves your device.

![platform](https://img.shields.io/badge/platform-iOS%20PWA-7c5cff) ![offline](https://img.shields.io/badge/works-offline-00e0c6)

## Features

- **Command Center** — live net worth, monthly cashflow, savings rate, and an
  animated 5-year wealth projection.
- **Bills** — track every bill, due dates & recurrence, autopay flags, on-time
  payment history, and the exact amount to **keep funded** so you never miss one.
  Per-paycheck "set aside" math included.
- **AI Money Coach** — a transparent, rule-based engine that tells you *why*:
  overdue alerts, utilization warnings, emergency-fund sizing, idle-cash nudges,
  and your personal monthly-investing target to hit your goal.
- **Plan** — cashflow donut, savings goals with progress, a millionaire-path
  calculator, and a debt-free **avalanche** payoff plan with an interest slider.
- **Invest** — portfolio tracker (stocks/ETFs/crypto/bonds), asset allocation,
  compound projections at different risk levels, and target allocation frameworks.
- **Credit** — an estimated FICO-style score gauge using public category weights,
  score-trend chart, utilization tracker, factor breakdown with fix-it tips, and a
  perfect-credit checklist. Log your real score to track progress.
- **Push notifications** for upcoming bills (iOS 16.4+ Home-Screen PWAs).
- **Private by design** — local storage only, with JSON **export/import** backups.

## Run it locally

```bash
npm install
npm run dev        # open the printed Local URL
# or a production build:
npm run build && npm run preview
```

## Install on your iPhone (no App Store needed)

1. Make sure your iPhone and computer are on the **same Wi-Fi**.
2. Run `npm run dev` (or `npm run preview`) — note the **Network** URL it prints
   (e.g. `http://192.168.1.x:5173`). For notifications to work, serve over HTTPS
   (e.g. via a tunnel like Cloudflare Tunnel / ngrok); opening over `localhost`
   on the phone via such a tunnel also works.
3. Open that URL in **Safari** on your iPhone.
4. Tap **Share → Add to Home Screen**. Open WealthOS from the new icon — it now
   runs full-screen like a native app, fully offline.
5. In **Settings → Bill reminders**, tap **Enable** to allow notifications.

> Regenerate the app icons anytime with `node scripts/gen-icons.mjs`.

## A note on financial advice

WealthOS provides **educational tools and general frameworks, not personalized
financial, tax, or investment advice**. It will never tell you to buy a specific
ticker. Markets carry risk including loss of principal, and no app can guarantee
a return or net-worth outcome. Consider a licensed fiduciary advisor before major
decisions. Estimated credit scores are for guidance only and are not your official
FICO/VantageScore — check your real score free via your bank or annualcreditreport.com.

## Tech

React 18 · TypeScript · Vite · Zustand (persisted) · Recharts · Framer Motion ·
vite-plugin-pwa (offline service worker) · date-fns.
