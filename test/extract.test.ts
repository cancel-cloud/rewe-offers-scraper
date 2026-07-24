import { describe, expect, it } from "vitest";

import {
  deduplicateOffers,
  normalizeOffer,
  type RawOffer,
} from "../src/extract.js";

describe("normalizeOffer", () => {
  it("normalizes whitespace and extracts unit price and deposit", () => {
    const offer = normalizeOffer({
      category: "  Bier ",
      name: " Beck’s   Pils ",
      description:
        "versch. Sorten, je 20 x 0,5-l-Fl.-Kasten, (1 l = 1,15 €), zzgl. 3,10 € Pfand",
      price: " 11,49 € ",
      promotion: " Knaller ",
    });

    expect(offer).toEqual({
      category: "Bier",
      name: "Beck’s Pils",
      description:
        "versch. Sorten, je 20 x 0,5-l-Fl.-Kasten, (1 l = 1,15 €), zzgl. 3,10 € Pfand",
      price: "11,49 €",
      promotion: "Knaller",
      unitPrice: "1 l = 1,15 €",
      deposit: "3,10 € Pfand",
    });
  });

  it("omits empty optional values", () => {
    const offer = normalizeOffer({
      category: "Kühlung",
      name: "Milch",
      description: "",
      price: "0,99 €",
      promotion: "",
      imageUrl: "   ",
      bonusAmount: "",
    });

    expect(offer).toEqual({
      category: "Kühlung",
      name: "Milch",
      description: "",
      price: "0,99 €",
      promotion: "",
    });
  });
});

describe("deduplicateOffers", () => {
  it("deduplicates repeated offers and fills missing optional fields", () => {
    const rawOffers: RawOffer[] = [
      {
        category: "Top-Angebote in deinem Markt",
        name: "Licher",
        description: "je 20 x 0,5-l-Fl.-Kasten",
        price: "10,99 €",
        promotion: "Aktion",
      },
      {
        category: "Bier",
        name: "licher",
        description: " je 20 x 0,5-l-Fl.-Kasten ",
        price: "10,99 €",
        promotion: "Aktion",
        imageUrl: "https://img.example/licher.webp",
        bonusAmount: "0,10 €",
      },
    ];

    expect(deduplicateOffers(rawOffers)).toEqual([
      {
        category: "Top-Angebote in deinem Markt",
        name: "Licher",
        description: "je 20 x 0,5-l-Fl.-Kasten",
        price: "10,99 €",
        promotion: "Aktion",
        imageUrl: "https://img.example/licher.webp",
        bonusAmount: "0,10 €",
      },
    ]);
  });
});
