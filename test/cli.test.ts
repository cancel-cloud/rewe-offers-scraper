import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKET_URL,
  parseArgs,
  runCli,
  writeOffersJson,
} from "../src/cli.js";
import type { OffersResult } from "../src/types.js";

const execFileAsync = promisify(execFile);

describe("parseArgs", () => {
  it("uses the Weilmünster market and offers.json by default", () => {
    expect(parseArgs([])).toEqual({
      url: DEFAULT_MARKET_URL,
      output: "offers.json",
      headed: true,
      help: false,
    });
  });

  it("supports URL, output, headed, and help options", () => {
    expect(
      parseArgs([
        "--url",
        "https://www.rewe.de/angebote/test/",
        "--output",
        "data/latest.json",
        "--headed",
        "--help",
      ]),
    ).toEqual({
      url: "https://www.rewe.de/angebote/test/",
      output: "data/latest.json",
      headed: true,
      help: true,
    });
  });

  it.each([
    [["--unknown"], /unknown argument/i],
    [["--url"], /requires a value/i],
    [["--output"], /requires a value/i],
  ])("rejects invalid arguments %j", (args, message) => {
    expect(() => parseArgs(args)).toThrow(message);
  });
});

describe("writeOffersJson", () => {
  it("creates parent directories and writes formatted validated JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rewe-scraper-"));
    const output = join(directory, "nested", "offers.json");
    const result: OffersResult = {
      sourceUrl: DEFAULT_MARKET_URL,
      scrapedAt: "2026-07-24T18:00:00.000Z",
      store: {
        name: "REWE Familie Özdemir OHG",
        address: "Mühlweg 12 35789 Weilmünster",
      },
      offerPeriod: "Diese Woche 20.7. bis 26.7.",
      productCount: 1,
      products: [
        {
          category: "Bier",
          name: "Licher",
          description: "je Kasten",
          price: "10,99 €",
          promotion: "Aktion",
        },
      ],
    };

    await writeOffersJson(output, result);

    const content = await readFile(output, "utf8");
    expect(content).toBe(`${JSON.stringify(result, null, 2)}\n`);
  });

  it("rejects a mismatched declared product count", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rewe-scraper-"));
    const invalid = {
      sourceUrl: DEFAULT_MARKET_URL,
      scrapedAt: "2026-07-24T18:00:00.000Z",
      store: {
        name: "REWE",
        address: "Mühlweg 12",
      },
      offerPeriod: "Diese Woche",
      productCount: 2,
      products: [
        {
          category: "Bier",
          name: "Licher",
          description: "",
          price: "10,99 €",
          promotion: "Aktion",
        },
      ],
    } as OffersResult;

    await expect(
      writeOffersJson(join(directory, "offers.json"), invalid),
    ).rejects.toThrow(/product count/i);
  });
});

describe("runCli", () => {
  it("prints help without starting a scrape", async () => {
    let scrapeCalls = 0;
    const messages: string[] = [];

    await runCli(["--help"], {
      scrape: async () => {
        scrapeCalls += 1;
        throw new Error("should not run");
      },
      log: (message) => messages.push(message),
    });

    expect(scrapeCalls).toBe(0);
    expect(messages.join("\n")).toMatch(/npm run scrape/);
  });

  it("runs through the package command entrypoint", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      ["run", "scrape", "--", "--help"],
      { cwd: process.cwd() },
    );

    expect(stdout).toMatch(/REWE offers scraper/);
  });
});
