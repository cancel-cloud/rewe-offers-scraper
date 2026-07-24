#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { scrapeOffers } from "./scraper.js";
import {
  offersResultSchema,
  type OffersResult,
} from "./types.js";

export const DEFAULT_MARKET_URL =
  "https://www.rewe.de/angebote/weilmuenster/240209/rewe-markt-muehlweg-12/";

export interface CliOptions {
  url: string;
  output: string;
  headed: boolean;
  help: boolean;
}

export interface CliDependencies {
  scrape?: typeof scrapeOffers;
  log?: (message: string) => void;
}

const HELP = `REWE offers scraper

Usage:
  npm run scrape
  npm run scrape -- --output data/offers.json
  npm run scrape -- --url <rewe-offers-url> [--headed]

Options:
  --url <url>       REWE market offers URL
  --output <path>   JSON output path (default: offers.json)
  --headed          Use visible browser mode (already the default)
  --help, -h        Show this help
`;

export function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    url: DEFAULT_MARKET_URL,
    output: "offers.json",
    headed: true,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--headed") {
      options.headed = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--url" || argument === "--output") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} requires a value`);
      }

      if (argument === "--url") {
        options.url = value;
      } else {
        options.output = value;
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export async function writeOffersJson(
  outputPath: string,
  result: OffersResult,
): Promise<void> {
  const validated = offersResultSchema.parse(result);
  if (validated.productCount !== validated.products.length) {
    throw new Error(
      `Product count ${validated.productCount} does not match ${validated.products.length} products`,
    );
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
}

export async function runCli(
  args: readonly string[],
  dependencies: CliDependencies = {},
): Promise<void> {
  const options = parseArgs(args);
  const log = dependencies.log ?? console.log;

  if (options.help) {
    log(HELP);
    return;
  }

  const result = await (dependencies.scrape ?? scrapeOffers)(options.url, {
    headed: options.headed,
  });
  const outputPath = resolve(options.output);
  await writeOffersJson(outputPath, result);
  log(`Wrote ${result.productCount} offers to ${outputPath}`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`REWE scrape failed: ${message}`);
    process.exitCode = 1;
  });
}
