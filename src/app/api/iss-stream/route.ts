import { NextResponse } from "next/server";

// YouTube deprecated the /embed/live_stream?channel=ID embed form, so we resolve the channel's
// *current* live video ID server-side. Crucially we also check the live video's TITLE: NASA's
// channel sometimes airs documentaries/briefings on its live slot, and we must NOT embed those —
// only the genuine "Live ... International Space Station" earth-view stream.

export type IssStreamResponse = {
  videoId: string | null;
  channelId: string | null;
  title: string | null;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

// NASA's official YouTube channel hosts "Live High-Definition Views from the International Space
// Station". (This is the channel @NASA/live resolves to.)
const CANDIDATE_CHANNELS = [
  "UCLA_DiR1FfKNvjuUpBHmylQ", // NASA (official)
];

const TTL_MS = 10 * 60_000;
const YT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type CacheRecord = { payload: IssStreamResponse; expiresAt: number };

let cache: CacheRecord | null = null;

// The live video must look like the ISS earth-view stream and NOT like a documentary/briefing.
function isIssFeedTitle(title: string): boolean {
  const t = title.toLowerCase();
  const looksIss = /international space station|space station|\biss\b|earth from (the )?space/.test(t);
  const looksOther =
    /documentary|our (earth|planet|universe|solar)|how the universe|cosmos|briefing|news conference|press conference|artemis|launch|replay/.test(
      t,
    );
  return looksIss && !looksOther;
}

function extractLive(html: string): { videoId: string; title: string } | null {
  if (!/"isLiveNow":true|"isLive":true/.test(html)) {
    return null;
  }

  const canonical = html.match(
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/,
  );
  const videoId = canonical?.[1] ?? html.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1];
  if (!videoId) {
    return null;
  }

  const title =
    html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ??
    html.match(/<title>([^<]*)<\/title>/)?.[1] ??
    "";

  return { videoId, title };
}

async function resolveIssVideo(): Promise<{ videoId: string; channelId: string; title: string } | null> {
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
      const live = extractLive(await upstream.text());
      // Only accept it if the current live video is actually the ISS earth-view stream.
      if (live && isIssFeedTitle(live.title)) {
        return { videoId: live.videoId, channelId, title: live.title };
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
    const resolved = await resolveIssVideo();
    if (!resolved) {
      throw new Error("Live ISS earth-view stream not currently airing");
    }

    const payload: IssStreamResponse = {
      videoId: resolved.videoId,
      channelId: resolved.channelId,
      title: resolved.title,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    cache = { payload, expiresAt: now + TTL_MS };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ISS stream resolve failed";
    // Serve the last known-good ISS video if we have one; otherwise report none (the client
    // shows a placeholder rather than risk embedding a documentary).
    if (cache && cache.payload.videoId) {
      return NextResponse.json({ ...cache.payload, stale: true, error: message } satisfies IssStreamResponse);
    }
    return NextResponse.json(
      {
        videoId: null,
        channelId: null,
        title: null,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: message,
      } satisfies IssStreamResponse,
      { status: 200 },
    );
  }
}
