import { NextResponse } from "next/server";

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

const SYMBOLS: Array<{ code: string; label: string }> = [
  { code: "spy.us", label: "SPY" },
  { code: "qqq.us", label: "QQQ" },
  { code: "aapl.us", label: "AAPL" },
  { code: "msft.us", label: "MSFT" },
  { code: "nvda.us", label: "NVDA" },
  { code: "amzn.us", label: "AMZN" },
  { code: "meta.us", label: "META" },
  { code: "googl.us", label: "GOOGL" },
  { code: "tsla.us", label: "TSLA" },
];

const TTL_MS = 60_000;
let cache: CacheRecord | null = null;

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "N/D") {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseSingleQuote(csv: string): Omit<StockQuote, "symbol"> | null {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const cols = lines[1].split(",");
  if (cols.length < 7) {
    return null;
  }

  const open = toNumber(cols[3]);
  const close = toNumber(cols[6]);
  if (close === null) {
    return null;
  }

  let changePercent: number | null = null;
  if (open !== null && open > 0) {
    changePercent = ((close - open) / open) * 100;
  }

  return {
    price: close,
    changePercent,
  };
}

async function fetchQuotes(): Promise<StocksApiResponse> {
  const quoteResults = await Promise.all(
    SYMBOLS.map(async (entry) => {
      const url = `https://stooq.com/q/l/?s=${entry.code}&f=sd2t2ohlcv&h&e=csv`;
      const upstream = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });

      if (!upstream.ok) {
        return null;
      }

      const text = await upstream.text();
      const parsed = parseSingleQuote(text);
      if (!parsed) {
        return null;
      }

      return {
        symbol: entry.label,
        price: parsed.price,
        changePercent: parsed.changePercent,
      } satisfies StockQuote;
    }),
  );

  const quotes = quoteResults.filter((quote): quote is StockQuote => quote !== null);
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
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  }

  try {
    const payload = await fetchQuotes();
    cache = {
      payload,
      expiresAt: now + TTL_MS,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        ...cache.payload,
        stale: true,
        error: error instanceof Error ? error.message : "Stocks fetch failed",
      } satisfies StocksApiResponse);
    }

    return NextResponse.json(
      {
        quotes: [],
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Stocks fetch failed",
      } satisfies StocksApiResponse,
      { status: 200 },
    );
  }
}
