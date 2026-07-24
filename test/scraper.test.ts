import { describe, expect, it } from "vitest";

import {
  hasSettled,
  hydrateSection,
  scrapeOffers,
  validateOfferUrl,
} from "../src/scraper.js";

describe("validateOfferUrl", () => {
  it("accepts an HTTP REWE offer URL", () => {
    expect(
      validateOfferUrl(
        "https://www.rewe.de/angebote/weilmuenster/240209/rewe-markt/",
      ).hostname,
    ).toBe("www.rewe.de");
  });

  it.each([
    "not-a-url",
    "file:///tmp/rewe.html",
    "https://example.com/angebote/test",
    "https://www.rewe.de/rezepte/",
  ])("rejects unsupported URL %s", (url) => {
    expect(() => validateOfferUrl(url)).toThrow(/REWE offer URL/i);
  });
});

describe("hasSettled", () => {
  it("requires a positive unchanged count for the configured iterations", () => {
    expect(hasSettled([0, 0, 0], 3)).toBe(false);
    expect(hasSettled([4, 4], 3)).toBe(false);
    expect(hasSettled([2, 4, 4, 4], 3)).toBe(true);
  });

  it("returns false when the most recent count changed", () => {
    expect(hasSettled([4, 4, 5], 3)).toBe(false);
  });
});

describe("hydrateSection", () => {
  it("runs full section scans until their positive counts stabilize", async () => {
    const productCounts = [5, 21, 21];
    let passes = 0;

    await hydrateSection(
      {
        scanPass: async () => {
          passes += 1;
          return productCounts.shift() ?? 21;
        },
      },
    );

    expect(passes).toBe(3);
  });

  it("fails when a section never loads a product", async () => {
    await expect(
      hydrateSection(
        {
          scanPass: async () => 0,
        },
        2,
      ),
    ).rejects.toThrow(/did not finish loading/i);
  });
});

describe("scrapeOffers", () => {
  const url =
    "https://www.rewe.de/angebote/weilmuenster/240209/rewe-markt/";

  it("normalizes, deduplicates, and counts loaded products", async () => {
    const result = await scrapeOffers(url, {
      loadPage: async () => ({
        store: {
          name: "REWE Familie Özdemir OHG",
          address: "Mühlweg 12 35789 Weilmünster",
        },
        offerPeriod: "Diese Woche 20.7. bis 26.7.",
        rawOffers: [
          {
            category: "Top-Angebote",
            name: "Licher",
            description: "je 20 x 0,5-l-Fl.-Kasten",
            price: "10,99 €",
            promotion: "Aktion",
          },
          {
            category: "Bier",
            name: "licher",
            description: "je 20 x 0,5-l-Fl.-Kasten",
            price: "10,99 €",
            promotion: "Aktion",
          },
        ],
      }),
      now: () => new Date("2026-07-24T18:00:00.000Z"),
    });

    expect(result.productCount).toBe(1);
    expect(result.products).toHaveLength(1);
    expect(result.scrapedAt).toBe("2026-07-24T18:00:00.000Z");
  });

  it("fails rather than returning a misleading empty result", async () => {
    await expect(
      scrapeOffers(url, {
        loadPage: async () => ({
          store: {
            name: "REWE Familie Özdemir OHG",
            address: "Mühlweg 12 35789 Weilmünster",
          },
          offerPeriod: "Diese Woche",
          rawOffers: [],
        }),
      }),
    ).rejects.toThrow(/no offer products/i);
  });
});
