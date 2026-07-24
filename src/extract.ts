import type { OfferProduct } from "./types.js";

export interface RawOffer {
  category: string;
  name: string;
  description: string;
  price: string;
  promotion: string;
  unitPrice?: string;
  deposit?: string;
  bonusAmount?: string;
  imageUrl?: string;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

function unitPriceFrom(description: string): string | undefined {
  const match = description.match(/\(([^()]*(?:=|à)[^()]*€)\)/i);
  return optionalText(match?.[1]);
}

function depositFrom(description: string): string | undefined {
  const match = description.match(/zzgl\.\s*(.+?Pfand)(?:[,;]|$)/i);
  return optionalText(match?.[1]);
}

export function normalizeOffer(raw: RawOffer): OfferProduct {
  const description = normalizeText(raw.description);
  const unitPrice = optionalText(raw.unitPrice) ?? unitPriceFrom(description);
  const deposit = optionalText(raw.deposit) ?? depositFrom(description);
  const bonusAmount = optionalText(raw.bonusAmount);
  const imageUrl = optionalText(raw.imageUrl);

  return {
    category: normalizeText(raw.category),
    name: normalizeText(raw.name),
    description,
    price: normalizeText(raw.price),
    promotion: normalizeText(raw.promotion),
    ...(unitPrice === undefined ? {} : { unitPrice }),
    ...(deposit === undefined ? {} : { deposit }),
    ...(bonusAmount === undefined ? {} : { bonusAmount }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
  };
}

function dedupeKey(offer: OfferProduct): string {
  return [offer.name, offer.description, offer.price]
    .map((value) => normalizeText(value).toLocaleLowerCase("de-DE"))
    .join("\u0000");
}

export function deduplicateOffers(rawOffers: RawOffer[]): OfferProduct[] {
  const offersByKey = new Map<string, OfferProduct>();

  for (const rawOffer of rawOffers) {
    const offer = normalizeOffer(rawOffer);
    const key = dedupeKey(offer);
    const existing = offersByKey.get(key);

    if (existing === undefined) {
      offersByKey.set(key, offer);
      continue;
    }

    offersByKey.set(key, {
      ...existing,
      ...(existing.unitPrice === undefined && offer.unitPrice !== undefined
        ? { unitPrice: offer.unitPrice }
        : {}),
      ...(existing.deposit === undefined && offer.deposit !== undefined
        ? { deposit: offer.deposit }
        : {}),
      ...(existing.bonusAmount === undefined && offer.bonusAmount !== undefined
        ? { bonusAmount: offer.bonusAmount }
        : {}),
      ...(existing.imageUrl === undefined && offer.imageUrl !== undefined
        ? { imageUrl: offer.imageUrl }
        : {}),
    });
  }

  return [...offersByKey.values()];
}
