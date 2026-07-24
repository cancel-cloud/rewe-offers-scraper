# REWE Offers Scraper

An on-demand TypeScript scraper for the current offers at:

> REWE Familie Özdemir OHG<br>
> Mühlweg 12, 35789 Weilmünster

The scraper opens the REWE market page in Chromium, visits every lazy-loaded
category, deduplicates repeated products, and writes validated JSON.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run scrape
```

This writes `offers.json` in the current directory.

A visible Chromium window opens while scraping. REWE's web application rejects
headless Chromium with a WAF challenge, so visible browser mode is the reliable
default.

Choose another output file:

```bash
npm run scrape -- --output data/rewe-offers.json
```

Use another REWE market-offers URL:

```bash
npm run scrape -- --url "https://www.rewe.de/angebote/..."
```

Show all CLI options:

```bash
npm run scrape -- --help
```

## JSON format

```json
{
  "sourceUrl": "https://www.rewe.de/angebote/...",
  "scrapedAt": "2026-07-24T18:00:00.000Z",
  "store": {
    "name": "REWE Familie Özdemir OHG",
    "address": "Mühlweg 12 35789 Weilmünster"
  },
  "offerPeriod": "Diese Woche 20.7. bis 26.7.",
  "productCount": 1,
  "products": [
    {
      "category": "Bier",
      "name": "Licher",
      "description": "versch. Sorten, je 20 x 0,5-l-Fl.-Kasten",
      "price": "10,99 €",
      "promotion": "Aktion",
      "unitPrice": "1 l = 1,10 €",
      "deposit": "3,10 € Pfand",
      "imageUrl": "https://img.rewe-static.de/..."
    }
  ]
}
```

Optional fields such as `unitPrice`, `deposit`, `bonusAmount`, and `imageUrl`
are omitted when REWE does not display them.

## Development

```bash
npm test
npm run typecheck
npm run build
```

The command deliberately fails instead of writing an empty or incomplete file
when a category never loads or REWE changes the page structure.
