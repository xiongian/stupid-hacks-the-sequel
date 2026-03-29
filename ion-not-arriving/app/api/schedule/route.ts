import { NextResponse } from "next/server";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

const GTFS_URL =
  "https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/2";

function unquote(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  const rawHeaders = lines[0].replace(/\r/g, "").replace(/^\uFEFF/, "");
  const headers = rawHeaders.split(",").map(unquote);
  return lines.slice(1).map((line) => {
    const values = line.replace(/\r/g, "").split(",");
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = unquote(values[i] || ""); });
    return record;
  });
}

function cleanName(name: string): string {
  return name.replace(/ - (Northbound|Southbound|Eastbound|Westbound)$/i, "").trim();
}

export async function GET() {
  const response = await fetch(GTFS_URL, { next: { revalidate: 3600 } });
  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch GTFS feed" }, { status: 502 });
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Find route
  const routes = parseCSV(await zip.file("routes.txt")!.async("string"));
  const ionRoute =
    routes.find((r) => r.route_short_name === "301") ??
    routes.find((r) => /ion|lrt|301/i.test(r.route_short_name + r.route_long_name)) ??
    routes[0];
  if (!ionRoute) return NextResponse.json({ error: "No routes found" }, { status: 404 });
  const routeId = ionRoute.route_id;

  // Trips
  const allTrips = parseCSV(await zip.file("trips.txt")!.async("string"));
  const ionTrips = allTrips.filter((t) => t.route_id === routeId);

  type TripInfo = { directionId: number; headsign: string };
  const tripMap = new Map<string, TripInfo>();
  ionTrips.forEach((t) => {
    tripMap.set(t.trip_id, {
      directionId: parseInt(t.direction_id),
      headsign: t.trip_headsign,
    });
  });

  // Stops
  type StopInfo = { name: string; lat: number; lon: number };
  const stopMap = new Map<string, StopInfo>();
  parseCSV(await zip.file("stops.txt")!.async("string")).forEach((s) =>
    stopMap.set(s.stop_id, {
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lon: parseFloat(s.stop_lon),
    })
  );

  // Stop times — build schedule and stop order per direction
  const stopTimes = parseCSV(await zip.file("stop_times.txt")!.async("string"));

  const schedule = new Map<string, Map<number, Set<number>>>();

  // Count stops per trip so we can pick the longest trip as representative
  const tripStopCount = new Map<string, number>();
  stopTimes.forEach((st) => {
    if (tripMap.has(st.trip_id))
      tripStopCount.set(st.trip_id, (tripStopCount.get(st.trip_id) ?? 0) + 1);
  });

  // Pick the longest trip per direction as representative for stop ordering
  const dirRepTrip: Record<number, string> = {};
  ionTrips.forEach((t) => {
    const dir = parseInt(t.direction_id);
    const current = dirRepTrip[dir];
    if (
      current === undefined ||
      (tripStopCount.get(t.trip_id) ?? 0) > (tripStopCount.get(current) ?? 0)
    ) {
      dirRepTrip[dir] = t.trip_id;
    }
  });

  const stopOrder: Record<number, { stopId: string; sequence: number }[]> = { 0: [], 1: [] };

  stopTimes.forEach((st) => {
    const trip = tripMap.get(st.trip_id);
    if (!trip) return;
    const { directionId } = trip;
    const stopId = st.stop_id;

    if (!schedule.has(stopId)) schedule.set(stopId, new Map());
    const byDir = schedule.get(stopId)!;
    if (!byDir.has(directionId)) byDir.set(directionId, new Set());
    const [h, m] = st.arrival_time.split(":").map(Number);
    byDir.get(directionId)!.add(h * 60 + m);

    if (st.trip_id === dirRepTrip[directionId]) {
      stopOrder[directionId].push({ stopId, sequence: parseInt(st.stop_sequence) });
    }
  });

  // Build per-direction stop lists
  const orderedStops: Record<number, { stopId: string; name: string; lat: number; lon: number }[]> = {};
  for (const dir of [0, 1]) {
    orderedStops[dir] = stopOrder[dir]
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ stopId }) => {
        const info = stopMap.get(stopId);
        return { stopId, name: info?.name ?? stopId, lat: info?.lat ?? 0, lon: info?.lon ?? 0 };
      });
  }

  type Station = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    stopIds: Record<number, string>;
  };

  // Build unified stations list from BOTH directions
  const stationsByName = new Map<string, {
    name: string;
    stopIds: Record<number, string>;
    lat: number;
    lon: number;
    sequence: number;
  }>();

  // Add all stops from both directions
  [0, 1].forEach((dir) => {
    orderedStops[dir]?.forEach((stop, idx) => {
      const clean = cleanName(stop.name);
      const existing = stationsByName.get(clean);
      
      if (existing) {
        // Station already exists, add this direction's stop ID
        existing.stopIds[dir] = stop.stopId;
      } else {
        // New station
        stationsByName.set(clean, {
          name: clean,
          stopIds: { [dir]: stop.stopId },
          lat: stop.lat,
          lon: stop.lon,
          sequence: dir === 0 ? idx : 1000 + idx, // Prefer dir 0 sequence for ordering
        });
      }
    });
  });

  // Convert to array and sort by sequence
  const stations: Station[] = Array.from(stationsByName.values())
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({
      id: s.stopIds[0] ?? s.stopIds[1] ?? '', // Use dir 0 as canonical, fallback to dir 1
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      stopIds: s.stopIds,
    }));

  // Headsigns
  const headsigns: Record<number, string> = {};
  ionTrips.forEach((t) => {
    const dir = parseInt(t.direction_id);
    if (!headsigns[dir]) headsigns[dir] = t.trip_headsign;
  });

  // Serialize schedule
  const scheduleOut: Record<string, Record<number, number[]>> = {};
  schedule.forEach((byDir, stopId) => {
    scheduleOut[stopId] = {};
    byDir.forEach((minutes, dir) => {
      scheduleOut[stopId][dir] = Array.from(minutes).sort((a, b) => a - b);
    });
  });

  // Build route paths for each direction (for map rendering)
  const routePaths: Record<number, [number, number][]> = {};
  for (const dir of [0, 1]) {
    if (orderedStops[dir]) {
      routePaths[dir] = orderedStops[dir].map((s) => [s.lat, s.lon]);
    }
  }

  return NextResponse.json({ stations, schedule: scheduleOut, headsigns, routePaths });
}
