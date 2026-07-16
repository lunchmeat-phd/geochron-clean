import { NextResponse } from "next/server";

// YouTube deprecated the /embed/live_stream?channel=ID embed form, so we resolve the
// channel's *current* live video ID server-side and let the client embed that directly.
// This self-heals whenever the upstream stream restarts under a new video ID.

export type IssStreamResponse = {
  videoId: string | null;
  channelId: string | null;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

// Candidate live ISS-earth-view channels, in priority order. The first one that is
// currently live wins. Having more than one means a single channel going dark does not
// blank the feed on an always-on display.
const CANDIDATE_CHANNELS = [
  "UCLA_DiR1FfKNvjuUpBHmylQ", // Space Videos — long-running ISS live earth view
  "UCJKfq5DrxrbTX3fWNMcgvGw", // NASA-adjacent ISS live mirror (fallback)
];

const TTL_MS = 30 * 60_000; // Live IDs change rarely; refresh every 30 min.
const YT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type CacheRecord = {
  payload: IssStreamResponse;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

function extractLiveVideoId(html: string): string | null {
  // Only trust the page if YouTube marks it as currently live.
  if (!/"isLiveNow":true|"isLive":true/.test(html)) {
    return null;
  }

  const canonical = html.match(
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/,
  );
  if (canonical?.[1]) {
    return canonical[1];
  }

  const videoId = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
  return videoId?.[1] ?? null;
}

async function resolveLiveVideo(): Promise<{ videoId: string; channelId: string } | null> {
  for (const channelId of CANDIDATE_CHANNELS) {
    try {
      const upstream = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
        cache: "no-store",
        headers: { "User-Agent": YT_UA, "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!upstream.ok) {
        continue;
      }
      const html = await upstream.text();
      const videoId = extractLiveVideoId(html);
      if (videoId) {
        return { videoId, channelId };
      }
    } catch {
      // Try the next candidate channel.
    }
  }
  return null;
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return NextResponse.json(cache.payload);
  }

  try {
    const resolved = await resolveLiveVideo();
    if (!resolved) {
      throw new Error("No live ISS stream currently available");
    }

    const payload: IssStreamResponse = {
      videoId: resolved.videoId,
      channelId: resolved.channelId,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    cache = { payload, expiresAt: now + TTL_MS };
    return NextResponse.json(payload);
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        ...cache.payload,
        stale: true,
        error: error instanceof Error ? error.message : "ISS stream resolve failed",
      } satisfies IssStreamResponse);
    }

    return NextResponse.json(
      {
        videoId: null,
        channelId: null,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "ISS stream resolve failed",
      } satisfies IssStreamResponse,
      { status: 200 },
    );
  }
}
