// @vitest-environment happy-dom

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

import { collectRawOffers } from "../src/page-extractor.js";

const execFileAsync = promisify(execFile);

beforeAll(async () => {
  document.body.innerHTML = await readFile(
    resolve("test/fixtures/rewe-offers.html"),
    "utf8",
  );
});

describe("collectRawOffers", () => {
  it("is self-contained when Playwright serializes it", () => {
    expect(collectRawOffers.toString()).not.toContain("__name");
  });

  it("stays self-contained through the tsx runtime used by the CLI", async () => {
    const { stdout } = await execFileAsync("npx", [
      "tsx",
      "-e",
      'import { collectRawOffers } from "./src/page-extractor.ts"; console.log(collectRawOffers.toString())',
    ]);

    expect(stdout).not.toContain("__name");
  });

  it("extracts product cards and excludes recipe and banner content", () => {
    const offers = collectRawOffers(document);

    expect(offers).toHaveLength(4);
    expect(offers.map((offer) => offer.name)).toEqual([
      "Licher",
      "Erasco Eintopf",
      "Licher",
      "Helle Tafeltrauben",
    ]);
  });

  it("associates products with the closest category and extracts fields", () => {
    const offers = collectRawOffers(document);

    expect(offers[0]).toEqual({
      category: "Top-Angebote in deinem Markt",
      name: "Licher",
      description:
        "versch. Sorten, je 20 x 0,5-l-Fl.-Kasten, (1 l = 1,10 €), zzgl. 3,10 € Pfand",
      price: "10,99 €",
      promotion: "Aktion",
      imageUrl: "https://img.example/licher.webp",
    });
    expect(offers[1]).toMatchObject({
      category: "Top-Angebote in deinem Markt",
      name: "Erasco Eintopf",
      bonusAmount: "0,10 €",
    });
    expect(offers[2]?.category).toBe("Bier");
    expect(offers[3]).toMatchObject({
      category: "Tiefpreis",
      promotion: "Tiefpreis",
    });
  });

  it("prefers the displayed promotion over compound accessibility wording", () => {
    const parsed = new DOMParser().parseFromString(
      `<section>
        <h2>Alkoholfreie Getränke</h2>
        <article>
          <h3>
            <a
              href="javascript:;"
              aria-label="Azur Mineralwasser, Mengenvorteil: 2 Kästen Aktionspreis 9,98 €"
            >Azur Mineralwasser</a>
          </h3>
          <p>versch. Sorten, je 12 x 1-l-Fl.-Kasten</p>
          <div>Mengenvorteil: je 2 x 12 x 1-l-Fl.-Kasten</div>
          <div>Aktion</div>
          <div>9,98 €</div>
        </article>
      </section>`,
      "text/html",
    );

    expect(collectRawOffers(parsed)[0]?.promotion).toBe("Aktion");
  });
});
