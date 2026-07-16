import { NextResponse } from "next/server";
import { readDiskCache, writeDiskCache } from "@/lib/diskCache";

const DISK_KEY = "stocks";

type StockQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
};

type StocksApiResponse = {
  quotes: StockQuote[];
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

type CacheRecord = {
  payload: StocksApiResponse;
  expiresAt: number;
};

// Yahoo Finance symbols. Indices use a caret prefix (URL-encoded as %5E).
const SYMBOLS: Array<{ code: string; label: string }> = [
  { code: "^GSPC", label: "S&P 500" },
  { code: "^DJI", label: "Dow Jones" },
  { code: "^IXIC", label: "Nasdaq" },
  { code: "^HSI", label: "Hang Seng" },
  { code: "SPY", label: "SPY" },
  { code: "QQQ", label: "QQQ" },
  { code: "AAPL", label: "AAPL" },
  { code: "MSFT", label: "MSFT" },
  { code: "NVDA", label: "NVDA" },
  { code: "AMZN", label: "AMZN" },
  { code: "META", label: "META" },
  { code: "GOOGL", label: "GOOGL" },
  { code: "TSLA", label: "TSLA" },
  { code: "VEA", label: "VEA (Developed Mkts)" },
  { code: "EEM", label: "EEM (Emerging Mkts)" },
  { code: "EWJ", label: "EWJ (Japan)" },
  { code: "EWU", label: "EWU (UK)" },
  { code: "EWG", label: "EWG (Germany)" },
];

// Yahoo rate-limits aggressively by IP, so cache generously — a stock ticker on an
// ambient wall display does not need sub-minute freshness.
const TTL_MS = 5 * 60_000;
// Browser-like UA; Yahoo is far more likely to 429/deny bare requests.
const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

let cache: CacheRecord | null = null;

const LABEL_BY_CODE = new Map(SYMBOLS.map((entry) => [entry.code, entry]));

function changePercentFrom(price: unknown, prevClose: unknown): number | null {
  const p = Number(price);
  const prev = Number(prevClose);
  if (!Number.isFinite(p) || !Number.isFinite(prev) || prev === 0) {
    return null;
  }
  return ((p - prev) / prev) * 100;
}

type SparkMeta = {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
};

// Preferred path: one batched request for every symbol via Yahoo's spark endpoint.
async function fetchViaSpark(): Promise<Map<string, StockQuote>> {
  const symbolParam = SYMBOLS.map((entry) => encodeURIComponent(entry.code)).join(",");
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbolParam}&range=1d&interval=1d`;

  const upstream = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!upstream.ok) {
    throw new Error(`Yahoo spark failed (${upstream.status})`);
  }

  const json = (await upstream.json()) as {
    spark?: { result?: Array<{ symbol?: string; response?: Array<{ meta?: SparkMeta }> }> };
  };

  const results = json.spark?.result ?? [];
  const quotes = new Map<string, StockQuote>();

  for (const result of results) {
    const code = result.symbol;
    if (!code) {
      continue;
    }
    const entry = LABEL_BY_CODE.get(code);
    const meta = result.response?.[0]?.meta;
    if (!entry || !meta) {
      continue;
    }
    const price = Number(meta.regularMarketPrice);
    if (!Number.isFinite(price)) {
      continue;
    }
    quotes.set(code, {
      symbol: entry.label,
      price,
      changePercent: changePercentFrom(price, meta.chartPreviousClose ?? meta.previousClose),
    });
  }

  return quotes;
}

// Fallback path: per-symbol chart requests, only for symbols still missing.
async function fetchViaChart(codes: string[]): Promise<Map<string, StockQuote>> {
  const quotes = new Map<string, StockQuote>();

  const settled = await Promise.allSettled(
    codes.map(async (code) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        code,
      )}?interval=1d&range=1d`;
      const upstream = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!upstream.ok) {
        return null;
      }
      const json = (await upstream.json()) as {
        chart?: { result?: Array<{ meta?: SparkMeta }> };
      };
      const meta = json.chart?.result?.[0]?.meta;
      const entry = LABEL_BY_CODE.get(code);
      if (!meta || !entry) {
        return null;
      }
      const price = Number(meta.regularMarketPrice);
      if (!Number.isFinite(price)) {
        return null;
      }
      return {
        code,
        quote: {
          symbol: entry.label,
          price,
          changePercent: changePercentFrom(price, meta.chartPreviousClose ?? meta.previousClose),
        } satisfies StockQuote,
      };
    }),
  );

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      quotes.set(result.value.code, result.value.quote);
    }
  }

  return quotes;
}

async function fetchQuotes(): Promise<StocksApiResponse> {
  const collected = new Map<string, StockQuote>();

  try {
    const spark = await fetchViaSpark();
    for (const [code, quote] of spark) {
      collected.set(code, quote);
    }
  } catch {
    // Spark unavailable — fall through to the per-symbol chart path below.
  }

  const missing = SYMBOLS.map((entry) => entry.code).filter((code) => !collected.has(code));
  if (missing.length > 0) {
    try {
      const chart = await fetchViaChart(missing);
      for (const [code, quote] of chart) {
        collected.set(code, quote);
      }
    } catch {
      // Ignore; we return whatever we managed to collect.
    }
  }

  // Preserve the configured display order.
  const quotes = SYMBOLS.map((entry) => collected.get(entry.code)).filter(
    (quote): quote is StockQuote => quote !== undefined,
  );

  if (quotes.length === 0) {
    throw new Error("Stocks source returned no quotes");
  }

  return {
    quotes,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return NextResponse.json(cache.payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  }

  try {
    const payload = await fetchQuotes();
    // If a rate-limit blip trimmed the batch, cache only briefly so the ticker
    // recovers quickly instead of showing a half-empty set for the full TTL.
    const isComplete = payload.quotes.length >= SYMBOLS.length;
    cache = {
      payload,
      expiresAt: now + (isComplete ? TTL_MS : 60_000),
    };
    if (isComplete) {
      void writeDiskCache<StocksApiResponse>(DISK_KEY, payload);
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stocks fetch failed";

    if (cache) {
      return NextResponse.json({
        ...cache.payload,
        stale: true,
        error: message,
      } satisfies StocksApiResponse);
    }

    // Cold start with upstream down — fall back to last-good quotes persisted on disk.
    const disk = await readDiskCache<StocksApiResponse>(DISK_KEY);
    if (disk) {
      return NextResponse.json({ ...disk, stale: true, error: message } satisfies StocksApiResponse);
    }

    return NextResponse.json(
      {
        quotes: [],
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: message,
      } satisfies StocksApiResponse,
      { status: 200 },
    );
  }
}
