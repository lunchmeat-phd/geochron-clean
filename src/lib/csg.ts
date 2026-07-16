export type CarrierStrikeGroupConfidence = "High" | "Medium" | "Low";

export type CarrierStrikeGroupFeatureKind = "operatingArea" | "lastKnown";

export type CarrierStrikeGroupProperties = {
  groupId: string;
  groupName: string;
  carrier: string;
  navy: string;
  confidence: CarrierStrikeGroupConfidence;
  confidenceScore: number;
  updatedAt: string;
  uncertaintyKm: number;
  evidenceCount: number;
  sourceCount: number;
  sourceSummary: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  featureKind: CarrierStrikeGroupFeatureKind;
};

export type CarrierStrikeGroupCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  CarrierStrikeGroupProperties
>;

export type CarrierStrikeGroupSourceHealth = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  reliability: number;
  evidenceCount: number;
  lastObservedAt: string | null;
  active: boolean;
};

export type CarrierStrikeGroupApiResponse = {
  data: CarrierStrikeGroupCollection;
  fetchedAt: string;
  stale: boolean;
  groupCount: number;
  activeSources: number;
  totalSources: number;
  averageConfidenceScore: number;
  sourceHealth: CarrierStrikeGroupSourceHealth[];
  error?: string;
};

type GroupCatalogEntry = {
  groupId: string;
  groupName: string;
  carrier: string;
  navy: string;
};

type Observation = {
  groupId: string;
  lon: number;
  lat: number;
  observedAt: string;
  baseUncertaintyKm: number;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceReliability: number;
  note: string;
};

type FusedGroup = {
  groupId: string;
  groupName: string;
  carrier: string;
  navy: string;
  lon: number;
  lat: number;
  updatedAt: string;
  uncertaintyKm: number;
  confidence: CarrierStrikeGroupConfidence;
  confidenceScore: number;
  evidenceCount: number;
  sourceCount: number;
  sourceSummary: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
};

// Real US carrier deployments sourced from the USNI News Fleet and Marine Tracker.
// Positions are the APPROXIMATE operating areas described in prose (e.g. "Philippine Sea"),
// not precise coordinates — the uncertainty circle on the map conveys that. To refresh,
// read the latest weekly tracker and update REPORT_DATE, REPORT_URL, and the coordinates.
const REPORT_DATE = "2026-07-13T12:00:00Z";
const REPORT_URL = "https://news.usni.org/2026/07/13/usni-news-fleet-and-marine-tracker-july-13-2026";

const GROUP_CATALOG: GroupCatalogEntry[] = [
  {
    groupId: "csg-cvn73",
    groupName: "George Washington CSG",
    carrier: "USS George Washington (CVN-73)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn71",
    groupName: "Theodore Roosevelt CSG",
    carrier: "USS Theodore Roosevelt (CVN-71)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn72",
    groupName: "Abraham Lincoln CSG",
    carrier: "USS Abraham Lincoln (CVN-72)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn77",
    groupName: "George H.W. Bush CSG",
    carrier: "USS George H.W. Bush (CVN-77)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn70",
    groupName: "Carl Vinson CSG",
    carrier: "USS Carl Vinson (CVN-70)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn68",
    groupName: "Nimitz CSG",
    carrier: "USS Nimitz (CVN-68)",
    navy: "United States Navy",
  },
];

const SOURCE_CATALOG = {
  usni: {
    sourceName: "USNI News Fleet & Marine Tracker",
    sourceUrl: REPORT_URL,
    sourceReliability: 0.9,
  },
} as const;

// One observation per carrier, from the latest weekly USNI tracker. baseUncertaintyKm
// reflects how vague the reported area is: an open-ocean patrol area is broad, an in-port
// carrier is tight.
const OBSERVATIONS: Observation[] = [
  {
    groupId: "csg-cvn73",
    lon: 132.0,
    lat: 18.0,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 450,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Operating in the Philippine Sea (CVW-5); first patrol of 2026.",
  },
  {
    groupId: "csg-cvn71",
    lon: -158.0,
    lat: 21.3,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 260,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Operating off Pearl Harbor, Hawaii for RIMPAC 2026.",
  },
  {
    groupId: "csg-cvn72",
    lon: -119.0,
    lat: 32.6,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 350,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Eastern Pacific; homeported at NAS North Island, Calif.",
  },
  {
    groupId: "csg-cvn77",
    lon: 62.0,
    lat: 16.0,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 450,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Operating in the Arabian Sea (CVW-7).",
  },
  {
    groupId: "csg-cvn70",
    lon: -120.0,
    lat: 32.2,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 320,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Departed San Diego, Calif.; operating in the Eastern Pacific.",
  },
  {
    groupId: "csg-cvn68",
    lon: -76.33,
    lat: 36.95,
    observedAt: REPORT_DATE,
    baseUncertaintyKm: 60,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Arrived at new homeport Naval Station Norfolk, Va.",
  },
];

function normalizeLon(lon: number): number {
  let normalized = lon;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function ageHours(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    return 168;
  }
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

function ageDecay(hours: number): number {
  // USNI publishes weekly, so decay on a multi-week half-life: a report that is a week
  // or two old should still read as reasonably confident, not collapse to the floor.
  const raw = Math.exp(-hours / 504);
  return Math.max(0.35, Math.min(1, raw));
}

function toConfidence(score: number): CarrierStrikeGroupConfidence {
  if (score >= 75) {
    return "High";
  }
  if (score >= 50) {
    return "Medium";
  }
  return "Low";
}

function haversineKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Approximate a geodesic circle in lon/lat for fast map rendering.
function circlePolygon(lon: number, lat: number, radiusKm: number, steps = 72): GeoJSON.Polygon {
  const clampedLat = clampLat(lat);
  const latRad = (clampedLat * Math.PI) / 180;
  const kmPerDegLat = 110.574;
  const kmPerDegLon = Math.max(111.320 * Math.cos(latRad), 0.0001);
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i += 1) {
    const theta = (2 * Math.PI * i) / steps;
    const dLat = (radiusKm * Math.sin(theta)) / kmPerDegLat;
    const dLon = (radiusKm * Math.cos(theta)) / kmPerDegLon;
    ring.push([normalizeLon(lon + dLon), clampLat(clampedLat + dLat)]);
  }

  return { type: "Polygon", coordinates: [ring] };
}

function weightedCenter(observations: Array<Observation & { weight: number }>): { lon: number; lat: number } {
  let x = 0;
  let y = 0;
  let latSum = 0;
  let weightSum = 0;

  for (const obs of observations) {
    const lonRad = (normalizeLon(obs.lon) * Math.PI) / 180;
    x += Math.cos(lonRad) * obs.weight;
    y += Math.sin(lonRad) * obs.weight;
    latSum += obs.lat * obs.weight;
    weightSum += obs.weight;
  }

  if (weightSum <= 0) {
    return { lon: 0, lat: 0 };
  }

  const lon = normalizeLon((Math.atan2(y, x) * 180) / Math.PI);
  const lat = clampLat(latSum / weightSum);
  return { lon, lat };
}

function fuseGroup(group: GroupCatalogEntry, observations: Observation[]): FusedGroup {
  const weighted = observations.map((obs) => {
    const age = ageHours(obs.observedAt);
    const decay = ageDecay(age);
    const weight = obs.sourceReliability * decay;
    return { ...obs, weight, age, decay };
  });

  const center = weightedCenter(weighted);
  const latest = [...weighted].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];

  const spreadKm =
    weighted.reduce((sum, obs) => sum + haversineKm(center.lon, center.lat, obs.lon, obs.lat), 0) /
    Math.max(weighted.length, 1);

  const weightedBaseUncertainty =
    weighted.reduce((sum, obs) => sum + obs.baseUncertaintyKm * obs.weight, 0) /
    Math.max(
      weighted.reduce((sum, obs) => sum + obs.weight, 0),
      0.0001,
    );

  const uncertaintyKm = Math.round(Math.min(800, Math.max(70, weightedBaseUncertainty + spreadKm * 0.85)));

  const avgWeight = weighted.reduce((sum, obs) => sum + obs.weight, 0) / Math.max(weighted.length, 1);
  const avgDecay = weighted.reduce((sum, obs) => sum + obs.decay, 0) / Math.max(weighted.length, 1);
  const precisionScore = Math.max(0, Math.min(1, 1 - uncertaintyKm / 900));

  const confidenceScore = Math.round((avgWeight * 0.55 + avgDecay * 0.15 + precisionScore * 0.3) * 100);
  const confidence = toConfidence(confidenceScore);

  const uniqueSourceNames = [...new Set(weighted.map((obs) => obs.sourceName))];
  const sourceSummary = uniqueSourceNames.join(", ");

  return {
    groupId: group.groupId,
    groupName: group.groupName,
    carrier: group.carrier,
    navy: group.navy,
    lon: center.lon,
    lat: center.lat,
    updatedAt: latest?.observedAt ?? new Date().toISOString(),
    uncertaintyKm,
    confidence,
    confidenceScore,
    evidenceCount: weighted.length,
    sourceCount: uniqueSourceNames.length,
    sourceSummary,
    summary: latest?.note ?? "Estimated from multi-source open reporting.",
    sourceName: latest?.sourceName ?? "Open-source synthesis",
    sourceUrl: latest?.sourceUrl ?? "https://www.navy.mil/",
  };
}

function buildSourceHealth(observations: Observation[]): CarrierStrikeGroupSourceHealth[] {
  const grouped = new Map<string, Observation[]>();
  for (const obs of observations) {
    if (!grouped.has(obs.sourceId)) {
      grouped.set(obs.sourceId, []);
    }
    grouped.get(obs.sourceId)?.push(obs);
  }

  return [...grouped.entries()]
    .map(([sourceId, list]) => {
      const latest = [...list].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
      const lastObservedAt = latest?.observedAt ?? null;
      const isActive =
        lastObservedAt !== null && Number.isFinite(Date.parse(lastObservedAt))
          ? Date.now() - Date.parse(lastObservedAt) <= 72 * 3_600_000
          : false;

      return {
        sourceId,
        sourceName: latest?.sourceName ?? sourceId,
        sourceUrl: latest?.sourceUrl ?? "",
        reliability: Math.round((latest?.sourceReliability ?? 0.5) * 100) / 100,
        evidenceCount: list.length,
        lastObservedAt,
        active: isActive,
      } satisfies CarrierStrikeGroupSourceHealth;
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.reliability - a.reliability);
}

export function buildCarrierStrikeGroupSnapshot(observations: Observation[] = OBSERVATIONS): {
  collection: CarrierStrikeGroupCollection;
  groupCount: number;
  activeSources: number;
  totalSources: number;
  averageConfidenceScore: number;
  sourceHealth: CarrierStrikeGroupSourceHealth[];
} {
  const groupsById = new Map(GROUP_CATALOG.map((group) => [group.groupId, group]));
  const byGroup = new Map<string, Observation[]>();

  for (const obs of observations) {
    if (!groupsById.has(obs.groupId)) {
      continue;
    }
    if (!byGroup.has(obs.groupId)) {
      byGroup.set(obs.groupId, []);
    }
    byGroup.get(obs.groupId)?.push(obs);
  }

  const fusedGroups = [...byGroup.entries()]
    .map(([groupId, list]) => {
      const group = groupsById.get(groupId);
      if (!group || list.length === 0) {
        return null;
      }
      return fuseGroup(group, list);
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const features: Array<GeoJSON.Feature<GeoJSON.Geometry, CarrierStrikeGroupProperties>> = [];

  for (const group of fusedGroups) {
    const common: Omit<CarrierStrikeGroupProperties, "featureKind"> = {
      groupId: group.groupId,
      groupName: group.groupName,
      carrier: group.carrier,
      navy: group.navy,
      confidence: group.confidence,
      confidenceScore: group.confidenceScore,
      updatedAt: group.updatedAt,
      uncertaintyKm: group.uncertaintyKm,
      evidenceCount: group.evidenceCount,
      sourceCount: group.sourceCount,
      sourceSummary: group.sourceSummary,
      summary: group.summary,
      sourceName: group.sourceName,
      sourceUrl: group.sourceUrl,
    };

    features.push({
      type: "Feature",
      id: `${group.groupId}-area`,
      properties: {
        ...common,
        featureKind: "operatingArea",
      },
      geometry: circlePolygon(group.lon, group.lat, group.uncertaintyKm),
    });

    features.push({
      type: "Feature",
      id: `${group.groupId}-point`,
      properties: {
        ...common,
        featureKind: "lastKnown",
      },
      geometry: {
        type: "Point",
        coordinates: [normalizeLon(group.lon), clampLat(group.lat)],
      },
    });
  }

  const sourceHealth = buildSourceHealth(observations);
  const averageConfidenceScore =
    fusedGroups.length > 0
      ? Math.round(
          fusedGroups.reduce((sum, group) => sum + group.confidenceScore, 0) / Math.max(1, fusedGroups.length),
        )
      : 0;

  return {
    collection: {
      type: "FeatureCollection",
      features,
    },
    groupCount: fusedGroups.length,
    activeSources: sourceHealth.filter((source) => source.active).length,
    totalSources: sourceHealth.length,
    averageConfidenceScore,
    sourceHealth,
  };
}
