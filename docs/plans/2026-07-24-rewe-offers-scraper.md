# REWE Offers Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an on-demand TypeScript CLI that loads the configured REWE market page, extracts every current sale product, and writes validated JSON.

**Architecture:** Playwright drives Chromium and waits for REWE's lazy-loaded offer sections to settle. Browser-side collection returns raw offer records; pure TypeScript normalization and deduplication converts them to the stable JSON schema before the CLI writes the output.

**Tech Stack:** Node.js 22+, TypeScript, Playwright, Vitest, Zod

---

### Task 1: Scaffold the TypeScript CLI project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/types.ts`

**Step 1: Write the package manifest**

Create scripts for `scrape`, `build`, `test`, and `typecheck`. Add runtime
dependencies `playwright` and `zod`, and development dependencies `tsx`,
`typescript`, `vitest`, and `@types/node`.

**Step 2: Write strict TypeScript configuration**

Configure ES2022, NodeNext modules, strict type checking, `src` and `test`
inclusion, and output to `dist`.

**Step 3: Define the output types and runtime schema**

Define `OfferProduct` and `OffersResult`, with required product fields
`category`, `name`, `description`, `price`, and `promotion`, plus optional
`unitPrice`, `deposit`, `bonusAmount`, and `imageUrl`. Define matching Zod
schemas to validate the final document.

**Step 4: Install dependencies and verify type checking**

Run: `npm install`

Run: `npm run typecheck`

Expected: TypeScript exits successfully.

**Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore src/types.ts
git commit -m "chore: scaffold TypeScript scraper"
```

### Task 2: Implement normalization and deduplication test-first

**Files:**
- Create: `src/extract.ts`
- Create: `test/extract.test.ts`

**Step 1: Write failing normalization tests**

Cover whitespace cleanup, omitted empty optional values, parsing unit-price and
deposit fragments from a description, and preservation of the displayed
German-formatted price.

```ts
expect(normalizeOffer({
  category: "  Bier ",
  name: " Beck’s Pils ",
  description: "je 20 x 0,5-l-Fl.-Kasten, (1 l = 1,15 €), zzgl. 3,10 € Pfand",
  price: "11,49 €",
  promotion: "Knaller"
})).toMatchObject({
  category: "Bier",
  name: "Beck’s Pils",
  unitPrice: "1 l = 1,15 €",
  deposit: "3,10 € Pfand"
});
```

**Step 2: Run the focused test and verify failure**

Run: `npm test -- test/extract.test.ts`

Expected: FAIL because `src/extract.ts` does not exist.

**Step 3: Implement minimal normalization**

Add `RawOffer`, `normalizeText`, `normalizeOffer`, and helpers that extract
parenthesized unit-price text and `zzgl.` deposit text without modifying the
original description.

**Step 4: Write failing deduplication tests**

Test that identical name/description/price combinations across categories
produce one product and that the later copy fills missing optional fields.

**Step 5: Implement deduplication**

Create a case-insensitive normalized key from name, description, and price.
Merge only missing optional values and preserve the first category.

**Step 6: Run tests and type checking**

Run: `npm test -- test/extract.test.ts`

Run: `npm run typecheck`

Expected: all tests pass and TypeScript exits successfully.

**Step 7: Commit**

```bash
git add src/extract.ts test/extract.test.ts
git commit -m "feat: normalize and deduplicate REWE offers"
```

### Task 3: Discover and encode the live REWE offer-card structure

**Files:**
- Create: `src/page-extractor.ts`
- Create: `test/fixtures/rewe-offers.html`
- Create: `test/page-extractor.test.ts`

**Step 1: Inspect the live rendered page**

Use the Playwright CLI to load the supplied market URL, accept or reject the
consent dialog if shown, scroll through the page, and inspect offer-card
ancestors around known products such as `Licher` and `Milka Schokolade`.
Prefer semantic or REWE-specific stable attributes over generated CSS classes.

**Step 2: Save a minimal synthetic fixture**

Represent two category sections, two real product cards, one repeated top
offer, one recipe card, and one promotional banner. Do not save a wholesale
copy of REWE's page.

**Step 3: Write failing DOM extraction tests**

Assert that the fixture yields the three raw product occurrences, associates
the nearest category heading, captures images and bonus amounts, and excludes
the recipe and banner.

**Step 4: Run the focused test and verify failure**

Run: `npm test -- test/page-extractor.test.ts`

Expected: FAIL because the DOM extractor is not implemented.

**Step 5: Implement browser-side extraction**

Export a serializable `collectRawOffers()` function whose body:

- finds product headings inside offer-card containers;
- finds the nearest category section heading;
- collects description, promotion label, displayed price, bonus, and image;
- rejects containers without both a product name and a sale price;
- returns plain `RawOffer[]`.

Use Vitest's DOM environment or a lightweight DOM fixture dependency only if
needed to test the same function outside Playwright.

**Step 6: Run focused and full tests**

Run: `npm test -- test/page-extractor.test.ts`

Run: `npm test`

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/page-extractor.ts test/fixtures/rewe-offers.html test/page-extractor.test.ts package.json package-lock.json
git commit -m "feat: extract offer cards from REWE markup"
```

### Task 4: Add browser loading and lazy-scroll stabilization

**Files:**
- Create: `src/scraper.ts`
- Create: `test/scraper.test.ts`

**Step 1: Write failing tests for validation and stabilization**

Test rejection of non-HTTP URLs and a pure `hasSettled` helper that becomes
true only after the offer count is unchanged for the configured number of
iterations.

**Step 2: Run the focused test and verify failure**

Run: `npm test -- test/scraper.test.ts`

Expected: FAIL because `src/scraper.ts` does not exist.

**Step 3: Implement the scraper**

Implement `scrapeOffers(url, options)` to:

- validate the URL;
- launch Chromium headless;
- navigate with `domcontentloaded`;
- dismiss the consent dialog when present;
- scroll by viewport increments;
- wait for product counts to stabilize with a hard iteration limit;
- call `collectRawOffers()` in the page;
- normalize and deduplicate products;
- read the store name, address, and offer period;
- validate the result with Zod;
- throw a specific error if zero products remain;
- close the browser in `finally`.

Allow a browser or page factory to be injected in tests so browser cleanup and
zero-product behavior can be verified without live network calls.

**Step 4: Run tests and type checking**

Run: `npm test -- test/scraper.test.ts`

Run: `npm test`

Run: `npm run typecheck`

Expected: all commands pass.

**Step 5: Commit**

```bash
git add src/scraper.ts test/scraper.test.ts
git commit -m "feat: scrape lazy-loaded REWE offers"
```

### Task 5: Implement the on-demand CLI

**Files:**
- Create: `src/cli.ts`
- Create: `test/cli.test.ts`
- Modify: `package.json`

**Step 1: Write failing argument tests**

Cover the default market URL, `--url`, `--output`, `--headed`, `--help`,
unknown arguments, and missing option values.

**Step 2: Run the focused test and verify failure**

Run: `npm test -- test/cli.test.ts`

Expected: FAIL because CLI argument parsing is missing.

**Step 3: Implement argument parsing and JSON writing**

Default output to `offers.json`. Resolve output paths from the current working
directory, create parent directories when needed, validate before writing,
write formatted UTF-8 JSON with a trailing newline, and set a nonzero exit code
with a concise error on failure.

**Step 4: Run tests, type checking, and build**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

Expected: all commands pass and `dist/` is produced.

**Step 5: Commit**

```bash
git add src/cli.ts test/cli.test.ts package.json
git commit -m "feat: add REWE scraper CLI"
```

### Task 6: Live verification and user documentation

**Files:**
- Create: `README.md`
- Create: `offers.json` (ignored runtime output)

**Step 1: Install the bundled browser**

Run: `npx playwright install chromium`

Expected: Chromium is installed or already current.

**Step 2: Run the live scraper**

Run: `npm run scrape -- --output offers.json`

Expected: command reports a nonzero product count and writes `offers.json`.

**Step 3: Independently validate the artifact**

Run:

```bash
node -e 'const x=require("./offers.json"); if(x.productCount!==x.products.length||x.productCount<1) process.exit(1); console.log(x.store.name, x.productCount)'
```

Expected: the Weilmünster store name and a positive count.

Inspect a sample from the beginning, middle, and end of the product array and
confirm names, descriptions, prices, and categories correspond to the live
page.

**Step 4: Write concise usage documentation**

Document prerequisites, installation, default use, URL/output overrides, JSON
shape, troubleshooting, and the fact that REWE markup may change.

**Step 5: Run the complete verification suite**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests pass, type checking passes, and the build completes.

**Step 6: Commit**

```bash
git add README.md
git commit -m "docs: explain REWE scraper usage"
```

### Task 7: Review and integrate

**Files:**
- Review: all tracked files

**Step 1: Review the branch diff**

Run: `git diff main...HEAD --check`

Run: `git status --short`

Expected: no whitespace errors; only ignored `offers.json` remains untracked or
the worktree is clean.

**Step 2: Re-run the live smoke test if implementation changed during review**

Run: `npm run scrape -- --output offers.json`

Expected: positive validated output.

**Step 3: Merge into the main branch**

From the main worktree:

```bash
git merge --ff-only feat/rewe-offers-scraper
```

Expected: `main` advances to the completed implementation.
