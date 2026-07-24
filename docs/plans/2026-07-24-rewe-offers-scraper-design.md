# REWE Offers Scraper Design

## Goal

Build a reusable, on-demand TypeScript command-line tool that collects every
current sale product shown for the REWE Familie Özdemir OHG market at Mühlweg
12, 35789 Weilmünster, and writes the result as structured JSON.

## Approach

The scraper will use Playwright with Chromium because the REWE offer page
loads some products dynamically. It will navigate to the configured market
page, dismiss a consent dialog if one is present, and scroll until the number
of discovered offer cards stops increasing. Extraction will happen from the
rendered page.

The CLI will have the Weilmünster market URL as its default. A `--url` option
will allow the same scraper to be pointed at another REWE offer page later
without adding scheduling or other premature features.

## Output

The generated JSON document will include:

- the source URL and scrape timestamp;
- store name and address;
- the displayed offer period;
- the number of unique products;
- an array of offer products.

Each product may contain:

- category;
- name;
- description;
- displayed price;
- promotion label such as `Aktion` or `Knaller`;
- unit-price text;
- deposit text;
- REWE Bonus amount;
- image URL.

Optional values will be omitted when REWE does not display them.

## Product Selection and Deduplication

Only actual product offers will be collected. Recipes, category artwork,
promotional banners, navigation links, and explanatory text will be ignored.

Products that appear in both the top-offers section and a normal category will
be deduplicated using a normalized combination of name, description, and
price. The first complete occurrence will define the product's primary
category; later occurrences can fill missing optional fields.

## Failure Handling

The command will exit unsuccessfully with an actionable message when:

- the URL is invalid;
- navigation or browser startup fails;
- no offer products can be found;
- the output file cannot be written.

The no-products failure is deliberate so that a REWE markup change cannot
silently produce a misleading empty result.

## Structure

- `src/cli.ts` parses arguments, runs the scraper, and writes JSON.
- `src/scraper.ts` controls Playwright, scrolling, and page extraction.
- `src/extract.ts` converts a normalized rendered-page representation into
  typed offer records and performs deduplication.
- `src/types.ts` defines the JSON schema.
- `test/` contains extraction fixtures and unit tests.
- `offers.json` is the default generated output and is ignored by Git.

## Verification

Fixture-based tests will cover field extraction, rejection of non-product
tiles, optional data, and deduplication. A live smoke run against the supplied
REWE market URL will verify that the browser can load the page and that the
result contains products with names and prices. The final JSON will also be
parsed independently to confirm that its declared count matches the product
array length.

## Operational Boundaries

The tool runs only when invoked and opens one browser session per run. It will
not crawl multiple markets, bypass access controls, or run on a schedule. The
implementation will use conservative waits and no parallel request fan-out.
