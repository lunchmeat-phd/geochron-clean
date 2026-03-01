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

const GROUP_CATALOG: GroupCatalogEntry[] = [
  {
    groupId: "csg-cvn78",
    groupName: "Carrier Strike Group 12",
    carrier: "USS Gerald R. Ford (CVN-78)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cvn71",
    groupName: "Carrier Strike Group 5",
    carrier: "USS Theodore Roosevelt (CVN-71)",
    navy: "United States Navy",
  },
  {
    groupId: "csg-cavour",
    groupName: "Italian Carrier Group",
    carrier: "ITS Cavour (550)",
    navy: "Italian Navy",
  },
  {
    groupId: "csg-charles-de-gaulle",
    groupName: "French Carrier Task Group",
    carrier: "FS Charles de Gaulle (R91)",
    navy: "French Navy",
  },
  {
    groupId: "csg-liaoning",
    groupName: "PLAN Liaoning Group",
    carrier: "Liaoning (16)",
    navy: "PLA Navy",
  },
];

const SOURCE_CATALOG = {
  navy_press: {
    sourceName: "Official Navy Press",
    sourceUrl: "https://www.navy.mil/",
    sourceReliability: 0.95,
  },
  usni: {
    sourceName: "USNI News",
    sourceUrl: "https://news.usni.org/",
    sourceReliability: 0.86,
  },
  janes_osint: {
    sourceName: "Defense OSINT Synthesis",
    sourceUrl: "https://www.janes.com/",
    sourceReliability: 0.78,
  },
  nato_exercise: {
    sourceName: "Exercise/Port Reporting",
    sourceUrl: "https://www.nato.int/",
    sourceReliability: 0.74,
  },
  regional_media: {
    sourceName: "Regional Defense Media",
    sourceUrl: "https://www.navalnews.com/",
    sourceReliability: 0.66,
  },
} as const;

const OBSERVATIONS: Observation[] = [
  {
    groupId: "csg-cvn78",
    lon: -29.1,
    lat: 49.6,
    observedAt: "2026-02-28T10:15:00Z",
    baseUncertaintyKm: 130,
    sourceId: "navy_press",
    ...SOURCE_CATALOG.navy_press,
    note: "Transit and exercise reporting in North Atlantic.",
  },
  {
    groupId: "csg-cvn78",
    lon: -26.4,
    lat: 48.8,
    observedAt: "2026-02-28T07:20:00Z",
    baseUncertaintyKm: 185,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Open-source fleet movement context update.",
  },
  {
    groupId: "csg-cvn78",
    lon: -30.2,
    lat: 50.0,
    observedAt: "2026-02-27T19:40:00Z",
    baseUncertaintyKm: 220,
    sourceId: "janes_osint",
    ...SOURCE_CATALOG.janes_osint,
    note: "OSINT synthesis estimate.",
  },

  {
    groupId: "csg-cvn71",
    lon: 135.5,
    lat: 20.0,
    observedAt: "2026-02-28T03:10:00Z",
    baseUncertaintyKm: 220,
    sourceId: "usni",
    ...SOURCE_CATALOG.usni,
    note: "Western Pacific operating estimate.",
  },
  {
    groupId: "csg-cvn71",
    lon: 138.9,
    lat: 22.2,
    observedAt: "2026-02-27T18:30:00Z",
    baseUncertaintyKm: 260,
    sourceId: "janes_osint",
    ...SOURCE_CATALOG.janes_osint,
    note: "Corroborated movement window.",
  },
  {
    groupId: "csg-cvn71",
    lon: 132.8,
    lat: 20.9,
    observedAt: "2026-02-27T08:45:00Z",
    baseUncertaintyKm: 300,
    sourceId: "regional_media",
    ...SOURCE_CATALOG.regional_media,
    note: "Regional reporting.",
  },

  {
    groupId: "csg-cavour",
    lon: 13.4,
    lat: 38.2,
    observedAt: "2026-02-28T11:25:00Z",
    baseUncertaintyKm: 95,
    sourceId: "nato_exercise",
    ...SOURCE_CATALOG.nato_exercise,
    note: "Exercise-linked position window.",
  },
  {
    groupId: "csg-cavour",
    lon: 14.1,
    lat: 37.7,
    observedAt: "2026-02-28T09:55:00Z",
    baseUncertaintyKm: 110,
    sourceId: "regional_media",
    ...SOURCE_CATALOG.regional_media,
    note: "Mediterranean task group reporting.",
  },
  {
    groupId: "csg-cavour",
    lon: 13.2,
    lat: 38.4,
    observedAt: "2026-02-28T05:10:00Z",
    baseUncertaintyKm: 120,
    sourceId: "janes_osint",
    ...SOURCE_CATALOG.janes_osint,
    note: "OSINT confidence check.",
  },

  {
    groupId: "csg-charles-de-gaulle",
    lon: 30.8,
    lat: 33.3,
    observedAt: "2026-02-28T06:30:00Z",
    baseUncertaintyKm: 140,
    sourceId: "nato_exercise",
    ...SOURCE_CATALOG.nato_exercise,
    note: "Eastern Mediterranean estimated operating area.",
  },
  {
    groupId: "csg-charles-de-gaulle",
    lon: 31.9,
    lat: 34.0,
    observedAt: "2026-02-27T23:15:00Z",
    baseUncertaintyKm: 170,
    sourceId: "janes_osint",
    ...SOURCE_CATALOG.janes_osint,
    note: "Supporting OSINT track.",
  },

  {
    groupId: "csg-liaoning",
    lon: 153.1,
    lat: 31.0,
    observedAt: "2026-02-27T13:25:00Z",
    baseUncertaintyKm: 320,
    sourceId: "regional_media",
    ...SOURCE_CATALOG.regional_media,
    note: "Sparse regional reporting.",
  },
  {
    groupId: "csg-liaoning",
    lon: 156.7,
    lat: 32.9,
    observedAt: "2026-02-27T01:20:00Z",
    baseUncertaintyKm: 380,
    sourceId: "janes_osint",
    ...SOURCE_CATALOG.janes_osint,
    note: "Broad open-source estimate.",
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
  const raw = Math.exp(-hours / 30);
  return Math.max(0.2, Math.min(1, raw));
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
