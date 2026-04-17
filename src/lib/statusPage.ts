/**
 * Parses live monitor data from https://status.tikvite.org HTML
 * (Astro island embeds serialized props with KV-backed checks).
 */

export interface MonitorLastCheck {
  operational: boolean;
  degraded: boolean;
  status: number;
  statusText: string;
  responseTimeMs: number;
  checkedAt: number;
  failureStreak: number;
}

export interface StatusMonitorRow {
  id: string;
  name: string;
  group: string;
  description: string;
  url: string;
  linkable: boolean;
  lastCheck: MonitorLastCheck | null;
}

export interface StatusPayload {
  pageTitle: string;
  fleet: {
    allOperational: boolean;
    time: number;
    loc: string;
  } | null;
  monitors: StatusMonitorRow[];
  fetchedAt: number;
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Astro's client-serialized props use [tag, payload] tuples */
function unwrapAstroSerialized(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, unwrapAstroSerialized(v)])
    );
  }
  if (!Array.isArray(value) || value.length !== 2) {
    return value;
  }
  const [tag, payload] = value as [number, unknown];
  if (tag === 1 && Array.isArray(payload)) {
    return payload.map(unwrapAstroSerialized);
  }
  if (tag === 0) {
    if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
      return Object.fromEntries(
        Object.entries(payload as Record<string, unknown>).map(([k, v]) => [k, unwrapAstroSerialized(v)])
      );
    }
    return payload;
  }
  return unwrapAstroSerialized(payload);
}

function extractPropsJson(html: string): string | null {
  const m = html.match(/<astro-island[^>]*\sprops="([^"]+)"/);
  return m?.[1] ?? null;
}

export function parseStatusPageHtml(html: string): StatusPayload {
  const encoded = extractPropsJson(html);
  if (!encoded) {
    throw new Error("Could not find status page props in HTML");
  }
  const decoded = decodeHtmlEntities(encoded);
  const raw = JSON.parse(decoded) as Record<string, unknown>;
  const data = unwrapAstroSerialized(raw) as {
    config: {
      settings: { title: string };
      monitors: Array<{
        id: string;
        name: string;
        group: string;
        description: string;
        url: string;
        linkable: boolean;
      }>;
    };
    kvMonitors: Record<
      string,
      {
        lastCheck: MonitorLastCheck | null;
      }
    >;
    kvMonitorsLastUpdate: {
      allOperational: boolean;
      time: number;
      loc: string;
    } | null;
  };

  const monitors: StatusMonitorRow[] = (data.config?.monitors ?? []).map((m) => {
    const kv = data.kvMonitors?.[m.id];
    return {
      id: m.id,
      name: m.name,
      group: m.group,
      description: m.description,
      url: m.url,
      linkable: m.linkable,
      lastCheck: kv?.lastCheck ?? null
    };
  });

  return {
    pageTitle: data.config?.settings?.title ?? "Status",
    fleet: data.kvMonitorsLastUpdate ?? null,
    monitors,
    fetchedAt: Date.now()
  };
}

export async function fetchStatusPayload(): Promise<StatusPayload> {
  const res = await fetch("https://status.tikvite.org/", {
    headers: { Accept: "text/html,application/xhtml+xml" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`status.tikvite.org returned ${res.status}`);
  }
  const html = await res.text();
  return parseStatusPageHtml(html);
}
