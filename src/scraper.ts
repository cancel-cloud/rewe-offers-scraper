import { chromium, type Page } from "playwright";

import { deduplicateOffers, type RawOffer } from "./extract.js";
import { collectRawOffers } from "./page-extractor.js";
import {
  offersResultSchema,
  type OffersResult,
} from "./types.js";

export interface LoadedOffersPage {
  store: {
    name: string;
    address: string;
  };
  offerPeriod: string;
  rawOffers: RawOffer[];
}

export interface ScrapeOptions {
  headed?: boolean;
  timeoutMs?: number;
  loadPage?: (url: string) => Promise<LoadedOffersPage>;
  now?: () => Date;
}

export function validateOfferUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid REWE offer URL: ${value}`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !/(^|\.)rewe\.de$/i.test(url.hostname) ||
    !url.pathname.startsWith("/angebote/")
  ) {
    throw new Error(`Invalid REWE offer URL: ${value}`);
  }

  return url;
}

export function hasSettled(
  counts: readonly number[],
  stableIterations: number,
): boolean {
  if (stableIterations < 1 || counts.length < stableIterations) {
    return false;
  }

  const recent = counts.slice(-stableIterations);
  return recent[0] !== 0 && recent.every((count) => count === recent[0]);
}

export interface HydratableSection {
  scanPass: () => Promise<number>;
}

export async function hydrateSection(
  section: HydratableSection,
  maxAttempts = 6,
): Promise<void> {
  const counts: number[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    counts.push(await section.scanPass());
    if (hasSettled(counts, 2)) {
      return;
    }
  }

  throw new Error("An offer section did not finish loading");
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function dismissConsent(page: Page): Promise<void> {
  await page
    .getByTestId("uc-deny-all-button")
    .click({ timeout: 3_000 })
    .catch(() => undefined);
}

async function hydrateCategorySections(page: Page): Promise<void> {
  const categoryNavigation = page.locator(
    'nav[aria-label="Kategorie-Übersicht"] a[href^="#"]',
  );
  const targets = await categoryNavigation.evaluateAll((links) =>
    links
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => href !== null && href.startsWith("#")),
  );

  for (const target of targets) {
    const section = page.locator(target);
    if ((await section.count()) === 0) {
      continue;
    }

    await hydrateSection(
      {
        scanPass: async () => {
          await section.scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          const geometry = await section.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              top: bounds.top + window.scrollY,
              bottom: bounds.bottom + window.scrollY,
              viewportHeight: window.innerHeight,
            };
          });
          const step = Math.max(
            300,
            Math.floor(geometry.viewportHeight * 0.75),
          );

          for (
            let top = geometry.top;
            top < geometry.bottom;
            top += step
          ) {
            await page.evaluate(
              (scrollTop) =>
                window.scrollTo({ top: scrollTop, behavior: "auto" }),
              top,
            );
            await page.waitForTimeout(120);
          }

          await section.evaluate((element) =>
            element.scrollIntoView({ block: "end" }),
          );
          await page.waitForTimeout(250);

          return section
            .locator('article h3 a[aria-label*="preis" i]')
            .count();
        },
      },
    );
  }
}

async function readMarket(page: Page): Promise<LoadedOffersPage["store"]> {
  const marketInfoLink = page.locator('main a[href*="wwident"]').first();
  const marketBlock = marketInfoLink.locator("xpath=..");
  const name = clean(await marketBlock.locator("h2").first().innerText());
  const lines = (await marketBlock.innerText())
    .split("\n")
    .map(clean)
    .filter(
      (line) =>
        line.length > 0 && line !== name && line.toLowerCase() !== "marktinfos",
    );

  return {
    name,
    address: clean(lines.join(" ")),
  };
}

async function loadLivePage(
  url: string,
  options: Required<Pick<ScrapeOptions, "headed" | "timeoutMs">>,
): Promise<LoadedOffersPage> {
  const browser = await chromium.launch({ headless: !options.headed });

  try {
    const context = await browser.newContext({ locale: "de-DE" });
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });
    await dismissConsent(page);
    await page
      .locator('article h3 a[aria-label*="preis" i]')
      .first()
      .waitFor({ state: "attached", timeout: options.timeoutMs });
    await hydrateCategorySections(page);

    const rawOffers = await page.evaluate(
      collectRawOffers as () => RawOffer[],
    );
    const store = await readMarket(page);
    const offerPeriod = clean(
      await page
        .locator('[role="tab"][aria-selected="true"]')
        .first()
        .innerText(),
    ).replace(/Woche(?=\d)/, "Woche ");

    return {
      store,
      offerPeriod,
      rawOffers,
    };
  } finally {
    await browser.close();
  }
}

export async function scrapeOffers(
  value: string,
  options: ScrapeOptions = {},
): Promise<OffersResult> {
  const url = validateOfferUrl(value);
  const loadPage =
    options.loadPage ??
    ((sourceUrl: string) =>
      loadLivePage(sourceUrl, {
        headed: options.headed ?? true,
        timeoutMs: options.timeoutMs ?? 30_000,
      }));
  const loaded = await loadPage(url.toString());
  const products = deduplicateOffers(loaded.rawOffers);

  if (products.length === 0) {
    throw new Error(
      "No offer products were found. REWE may have changed the page structure.",
    );
  }

  return offersResultSchema.parse({
    sourceUrl: url.toString(),
    scrapedAt: (options.now ?? (() => new Date()))().toISOString(),
    store: loaded.store,
    offerPeriod: loaded.offerPeriod,
    productCount: products.length,
    products,
  });
}
