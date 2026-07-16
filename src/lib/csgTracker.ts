import type { Observation } from "@/lib/csg";

// Auto-refresh of carrier positions from the USNI News Fleet & Marine Tracker (published weekly).
// USNI has no data API, so we fetch the latest tracker article via the WordPress REST API and
// parse each carrier's approximate operating area out of the prose. This is inherently fuzzy, so
// the caller keeps a last-good disk cache and a hardcoded seed as fallbacks.

const USNI_SEARCH_URL =
  "https://news.usni.org/wp-json/wp/v2/posts?search=Fleet%20and%20Marine%20Tracker&per_page=5&orderby=date&_fields=date,link,title,content";
const USNI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type Region = { lat: number; lon: number; uncertaintyKm: number };

// Specific operating areas + ports/homeports. Matched case-insensitively as substrings.
const PRIMARY_REGIONS: Record<string, Region> = {
  "Philippine Sea": { lat: 18, lon: 132, uncertaintyKm: 450 },
  "South China Sea": { lat: 13, lon: 115, uncertaintyKm: 400 },
  "East China Sea": { lat: 29, lon: 126, uncertaintyKm: 300 },
  "Sea of Japan": { lat: 40, lon: 135, uncertaintyKm: 300 },
  "Yellow Sea": { lat: 35, lon: 123, uncertaintyKm: 250 },
  "Arabian Sea": { lat: 16, lon: 62, uncertaintyKm: 450 },
  "Persian Gulf": { lat: 27, lon: 51, uncertaintyKm: 180 },
  "Arabian Gulf": { lat: 27, lon: 51, uncertaintyKm: 180 },
  "Gulf of Oman": { lat: 24.5, lon: 58.5, uncertaintyKm: 180 },
  "Gulf of Aden": { lat: 12, lon: 47, uncertaintyKm: 250 },
  "Red Sea": { lat: 20, lon: 38, uncertaintyKm: 300 },
  "Eastern Mediterranean": { lat: 33.5, lon: 31, uncertaintyKm: 250 },
  "Central Mediterranean": { lat: 36, lon: 16, uncertaintyKm: 300 },
  "Western Mediterranean": { lat: 39, lon: 5, uncertaintyKm: 300 },
  "Ionian Sea": { lat: 38, lon: 18, uncertaintyKm: 200 },
  "Adriatic": { lat: 42, lon: 16, uncertaintyKm: 150 },
  "Aegean": { lat: 38, lon: 25, uncertaintyKm: 150 },
  "North Atlantic": { lat: 50, lon: -30, uncertaintyKm: 500 },
  "Western Atlantic": { lat: 34, lon: -72, uncertaintyKm: 400 },
  "Eastern Pacific": { lat: 30, lon: -122, uncertaintyKm: 400 },
  "Western Pacific": { lat: 20, lon: 140, uncertaintyKm: 500 },
  "Coral Sea": { lat: -15, lon: 152, uncertaintyKm: 300 },
  "Bay of Bengal": { lat: 13, lon: 87, uncertaintyKm: 300 },
  "Indian Ocean": { lat: -10, lon: 75, uncertaintyKm: 600 },
  "Caribbean": { lat: 15, lon: -75, uncertaintyKm: 300 },
  // Ports / homeports (tight uncertainty)
  "Naval Station Norfolk": { lat: 36.95, lon: -76.33, uncertaintyKm: 50 },
  "Norfolk": { lat: 36.95, lon: -76.33, uncertaintyKm: 50 },
  "North Island": { lat: 32.68, lon: -117.2, uncertaintyKm: 60 },
  "San Diego": { lat: 32.68, lon: -117.2, uncertaintyKm: 60 },
  "Yokosuka": { lat: 35.29, lon: 139.66, uncertaintyKm: 50 },
  "Everett": { lat: 47.99, lon: -122.22, uncertaintyKm: 50 },
  "Bremerton": { lat: 47.55, lon: -122.65, uncertaintyKm: 50 },
  "Kitsap": { lat: 47.55, lon: -122.65, uncertaintyKm: 50 },
  "Newport News": { lat: 36.98, lon: -76.43, uncertaintyKm: 40 },
  "Pearl Harbor": { lat: 21.35, lon: -157.95, uncertaintyKm: 120 },
  "Hawaii": { lat: 21.35, lon: -157.95, uncertaintyKm: 200 },
  "Mayport": { lat: 30.39, lon: -81.42, uncertaintyKm: 40 },
  "Rota": { lat: 36.62, lon: -6.35, uncertaintyKm: 50 },
  "Souda Bay": { lat: 35.5, lon: 24.1, uncertaintyKm: 80 },
  "Guam": { lat: 13.44, lon: 144.66, uncertaintyKm: 80 },
  "Busan": { lat: 35.1, lon: 129.05, uncertaintyKm: 60 },
};

// Broad fallbacks, only used if no specific region matched.
const GENERIC_REGIONS: Record<string, Region> = {
  Mediterranean: { lat: 37, lon: 15, uncertaintyKm: 450 },
  Atlantic: { lat: 40, lon: -40, uncertaintyKm: 550 },
  Pacific: { lat: 20, lon: 150, uncertaintyKm: 600 },
};

// All 11 US CVNs; groupId matches GROUP_CATALOG (csg-cvn<hull>).
const CVN_HULLS = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78];

type Match = { region: Region; keyword: string; index: number; isHomeport: boolean };

function findRegionsInSegment(segment: string, baseIndex: number, table: Record<string, Region>): Match[] {
  const matches: Match[] = [];
  const lower = segment.toLowerCase();
  for (const [keyword, region] of Object.entries(table)) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index === -1) {
      continue;
    }
    // "homeported at Naval Station Norfolk" / "based out of San Diego" describe the home base,
    // not the current location; look back far enough to see the qualifier even when a base name
    // ("Naval Station …") sits between it and the place.
    const before = lower.slice(Math.max(0, index - 40), index);
    const isHomeport = /homeport|home port|based at|based out of|homeported/.test(before);
    matches.push({ region, keyword, index: baseIndex + index, isHomeport });
  }
  return matches;
}

// Pick the best region across ALL of a carrier's text segments: prefer a specific operating-area
// mention (not a homeport), then a homeport/port, then a broad theater — earliest wins within each.
function pickBestRegion(segments: Array<{ text: string; base: number }>): { region: Region; keyword: string } | null {
  const primary = segments.flatMap((s) => findRegionsInSegment(s.text, s.base, PRIMARY_REGIONS));
  const operating = primary.filter((m) => !m.isHomeport).sort((a, b) => a.index - b.index);
  if (operating.length > 0) {
    return operating[0];
  }
  const homeport = primary.filter((m) => m.isHomeport).sort((a, b) => a.index - b.index);
  if (homeport.length > 0) {
    return homeport[0];
  }
  const generic = segments
    .flatMap((s) => findRegionsInSegment(s.text, s.base, GENERIC_REGIONS))
    .sort((a, b) => a.index - b.index);
  return generic.length > 0 ? generic[0] : null;
}

// One text segment per carrier mention, bounded so it cannot bleed into a neighbouring entry:
// forward to the next carrier mention, backward to the carrier's own section header ("In the
// <Theater>", capitalised) or the previous carrier mention — whichever is closest.
function segmentsForHull(
  text: string,
  hull: number,
  mentionIndices: number[],
  sectionIndices: number[],
): Array<{ text: string; base: number }> {
  const segments: Array<{ text: string; base: number }> = [];
  const re = new RegExp(`CVN[-\\s]?${hull}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index;
    const nextMention = mentionIndices.find((p) => p > idx + 6) ?? text.length;
    const prevMention = [...mentionIndices].reverse().find((p) => p < idx - 6) ?? 0;
    const sectionStart = [...sectionIndices].reverse().find((p) => p < idx) ?? 0;
    const start = Math.max(idx - 240, prevMention, sectionStart);
    const end = Math.min(idx + 340, nextMention);
    segments.push({ text: text.slice(start, end), base: start });
  }
  return segments;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type UsniTrackerResult = {
  observations: Observation[];
  reportDate: string;
  reportUrl: string;
  reportTitle: string;
};

export async function fetchLatestUsniObservations(): Promise<UsniTrackerResult> {
  const response = await fetch(USNI_SEARCH_URL, {
    cache: "no-store",
    headers: { "User-Agent": USNI_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`USNI tracker fetch failed (${response.status})`);
  }

  const posts = (await response.json()) as Array<{
    date?: string;
    link?: string;
    title?: { rendered?: string };
    content?: { rendered?: string };
  }>;

  const post = posts.find((p) => /Fleet and Marine Tracker/i.test(p.title?.rendered ?? ""));
  if (!post || !post.content?.rendered) {
    throw new Error("No USNI Fleet & Marine Tracker article found");
  }

  const text = stripHtml(post.content.rendered);
  const reportDate = post.date ? new Date(post.date).toISOString() : new Date().toISOString();
  const reportUrl = post.link ?? "https://news.usni.org/category/fleet-tracker";
  const reportTitle = stripHtml(post.title?.rendered ?? "USNI Fleet & Marine Tracker");

  // Positions of every carrier mention, used to bound each carrier's window.
  const mentionIndices = [...text.matchAll(/CVN[-\s]?\d{2}\b/g)]
    .map((m) => m.index)
    .filter((i): i is number => typeof i === "number");
  // Capitalised "In the <Theater>" section headers ("in the" mid-sentence is lowercase).
  const sectionIndices = [...text.matchAll(/\bIn the /g)]
    .map((m) => m.index)
    .filter((i): i is number => typeof i === "number");

  const observations: Observation[] = [];
  for (const hull of CVN_HULLS) {
    const segments = segmentsForHull(text, hull, mentionIndices, sectionIndices);
    if (segments.length === 0) {
      continue;
    }
    const best = pickBestRegion(segments);
    if (!best) {
      continue;
    }

    observations.push({
      groupId: `csg-cvn${hull}`,
      lon: best.region.lon,
      lat: best.region.lat,
      observedAt: reportDate,
      baseUncertaintyKm: best.region.uncertaintyKm,
      sourceId: "usni",
      sourceName: "USNI News Fleet & Marine Tracker",
      sourceUrl: reportUrl,
      sourceReliability: 0.9,
      note: `Reported near ${best.keyword} — ${reportTitle}.`,
    });
  }

  if (observations.length === 0) {
    throw new Error("Parsed no carrier positions from USNI tracker");
  }

  return { observations, reportDate, reportUrl, reportTitle };
}
