import type { RawOffer } from "./extract.js";

export const collectRawOffers = function (
  root: Document = document,
): RawOffer[] {
  const helpers = {
    clean(value: string | null | undefined): string {
      return (value ?? "").replace(/\s+/g, " ").trim();
    },
    textLines(element: Element): string[] {
      return (element as HTMLElement).innerText
        .split("\n")
        .map(helpers.clean)
        .filter((line) => line.length > 0);
    },
  };

  const offers: RawOffer[] = [];
  const productLinks = root.querySelectorAll<HTMLAnchorElement>(
    'article h3 a[aria-label*="preis" i]',
  );

  for (const link of productLinks) {
    const article = link.closest("article");
    const heading = link.closest("h3");
    const section = article?.closest("section, [role='region']");
    const category = helpers.clean(section?.querySelector("h2")?.textContent);
    const name = helpers.clean(link.textContent);
    const label = helpers.clean(link.getAttribute("aria-label"));

    if (article === null || heading === null || category === "" || name === "") {
      continue;
    }

    const price = helpers.clean(label.match(/(\d+,\d{2}\s*€)/)?.[1]);
    if (price === "") {
      continue;
    }

    const promotionStem = helpers.clean(
      label.match(/,\s*([^,]+?)preis\s+\d+,\d{2}\s*€/i)?.[1],
    );
    const articleLines = helpers.textLines(article);
    const displayedPromotion = articleLines.find((line) =>
      /^(Aktion|Knaller|Tiefpreis)$/i.test(line),
    );
    const promotion =
      displayedPromotion ??
      (promotionStem === "Aktions"
        ? "Aktion"
        : promotionStem === "Tief"
          ? "Tiefpreis"
          : promotionStem);

    const descriptionContainer = heading.parentElement ?? article;
    const paragraphDescription = helpers.clean(
      descriptionContainer.querySelector("p")?.textContent,
    );
    const descriptionLines = [
      ...helpers.textLines(descriptionContainer),
      ...articleLines,
    ];
    const description =
      paragraphDescription ||
      (descriptionLines.find((line) => {
        if (
          line === name ||
          line === price ||
          line === promotion ||
          /REWE Bonus Guthaben/i.test(line) ||
          /^\d+,\d{2}\s*€$/.test(line)
        ) {
          return false;
        }

        return /(?:je |versch\.|zzgl\.|\d+(?:[,.]\d+)?-(?:g|kg|ml|l|St)|Fett)/i.test(
          line,
        );
      }) ??
        "");

    const bonusAmount = helpers.clean(
      label.match(/\+?(\d+,\d{2}\s*€)\s*REWE Bonus/i)?.[1],
    );
    const image = article.querySelector<HTMLImageElement>("img");
    const imageUrl = helpers.clean(image?.currentSrc || image?.src);

    offers.push({
      category,
      name,
      description,
      price,
      promotion,
      ...(bonusAmount === "" ? {} : { bonusAmount }),
      ...(imageUrl === "" ? {} : { imageUrl }),
    });
  }

  return offers;
};
