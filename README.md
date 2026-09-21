# CycleStudy

Research dashboard for Bitcoin’s weekly USD price against a **cycle clock**: analog-calibrated bottom/top ranges, optional classic **364-day bear / 1,064-day bull** timing, historical envelope, and 2015 / 2018 / 2022 analog paths that start at the last actual print.

This is a labeled reference study, not a trading system. Ranges are calibrated bands with quantified historical error — not single-date, single-price forecasts.

## Run locally (Vite)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4387](http://127.0.0.1:4387).

```bash
npm test       # model tests
npm run build  # production bundle in dist/
```

No accounts, database, or API keys. Embedded weekly history works offline. On load the Vite app fetches a live CoinGecko quote and refreshes post-peak Tuesdays through `/api/coingecko` (proxied by Vite).

## Downloadable HTML

A self-contained **`CycleStudy.html`** inlines JS, CSS, and the weekly series so you can open it with **File → Open** (`file://`) without running Vite.

1. Download [CycleStudy.html](https://github.com/4n1r0n/cyclestudy/releases/latest/download/CycleStudy.html) from the latest GitHub Release (or use the copy in this repo).
2. Open the file in a browser. The chart and history work offline.
3. Live CoinGecko quotes still try `https://api.coingecko.com`. If the browser blocks that (CORS / network), the page **shows the error** and keeps the embedded weeklies.

Rebuild the HTML after source changes:

```bash
npm run build:html
```

That writes `CycleStudy.html` at the repo root and in `dist/`.

## Data

- Tuesday weekly closes **27 Nov 2012 – 30 Sep 2025** from the original study file (upstream vendor was not documented there).
- From **7 Oct 2025** (week of the 6 Oct 2025 study peak) through **15 Sep 2026**, every Tuesday is a **CoinGecko** daily USD print on that date (`/coins/bitcoin/market_chart/range`, vs_currency=usd), resampled to Tuesdays. That interval is actual BTC, not analog or envelope values.
- The Sunday **29 Mar 2026** snapshot from the original file is not a weekly close and is omitted.
- Live quote: CoinGecko `simple/price` for bitcoin/USD. Plotted on the same orange actual path as the last point (not a Tuesday close).

## Projection model

Projections **start at the last actual print** (live quote if fresh, otherwise the last Tuesday close) and run **forward only**. They are **off by default**; each series is a legend toggle.

**Default (analog-calibrated)**

- **Time:** median of the two non-approximate historical bears (2017–18, 2021–22) and median of the three completed bulls. Inner date band ±14 days; outer late band +43 days (2013-style).
- **Bottom price:** weekly-close remaining value at each analog trough, scaled to the $126,198.07 study peak — not the original $18.6k–$28.6k constants.
- **Top price:** 2018 and 2022 bull multiples applied to the median analog bottom. The 2013-era blow-off multiple is excluded from the inner band.
- **Paths from today:** remaining analog shape ratio-scaled onto the last actual print; envelope min/mean/max ratio-scaled from today’s cycle fraction so they meet at that print; working model path from the print through the working bottom and top midpoints.

**Classic toggle** restores 364 / 1,064 days and the original dollar ranges for comparison.

## Stack

Vite, React, TypeScript, Tailwind CSS, shadcn/ui primitives, Recharts.
