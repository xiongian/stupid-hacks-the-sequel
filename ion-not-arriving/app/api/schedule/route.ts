import { NextResponse } from "next/server";
import JSZip from "jszip";

export const revalidate = 3600; // Cache GTFS data for 1 hour

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
    headers.forEach((h, i) => {
      record[h] = unquote(values[i] || "");
    });
    return record;
  });
}

export async function GET() {
  const response = await fetch(GTFS_URL, { next: { revalidate: 3600 } });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch GTFS feed" },
      { status: 502 }
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // This is the LRT-only feed, so just use the first route
  const routesText = await zip.file("routes.txt")!.async("string");
  const routes = parseCSV(routesText);
  const ionRoute =
    routes.find((r) => r.route_short_name === "301") ??
    routes.find((r) => /ion|lrt|301/i.test(r.route_short_name + r.route_long_name)) ??
    routes[0];
  if (!ionRoute) {
    return NextResponse.json({ error: "No routes found in feed" }, { status: 404 });
  }
  const routeId = ionRoute.route_id;

  // Load trips for route 301
  const tripsText = await zip.file("trips.txt")!.async("string");
  const allTrips = parseCSV(tripsText);
  const ionTrips = allTrips.filter((t) => t.route_id === routeId);

  type TripInfo = { directionId: number; headsign: string };
  const tripMap = new Map<string, TripInfo>();
  ionTrips.forEach((t) => {
    tripMap.set(t.trip_id, {
      directionId: parseInt(t.direction_id),
      headsign: t.trip_headsign,
    });
  });

  // Load stop names and coordinates
  const stopsText = await zip.file("stops.txt")!.async("string");
  type StopInfo = { name: string; lat: number; lon: number };
  const stopMap = new Map<string, StopInfo>();
  parseCSV(stopsText).forEach((s) =>
    stopMap.set(s.stop_id, {
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lon: parseFloat(s.stop_lon),
    })
  );

  // Load stop_times and build schedule
  const stopTimesText = await zip.file("stop_times.txt")!.async("string");
  const stopTimes = parseCSV(stopTimesText);

  // schedule[stopId][directionId] = sorted array of minutes-past-midnight
  const schedule = new Map<string, Map<number, Set<number>>>();

  // Also track stop order from one representative trip per direction
  const dirRepTrip: Record<number, string> = {};
  ionTrips.forEach((t) => {
    const dir = parseInt(t.direction_id);
    if (dirRepTrip[dir] === undefined) dirRepTrip[dir] = t.trip_id;
  });

  const stopOrder: Record<number, { stopId: string; sequence: number }[]> = {
    0: [],
    1: [],
  };

  stopTimes.forEach((st) => {
    const trip = tripMap.get(st.trip_id);
    if (!trip) return;

    const { directionId } = trip;
    const stopId = st.stop_id;

    if (!schedule.has(stopId)) schedule.set(stopId, new Map());
    const byDir = schedule.get(stopId)!;
    if (!byDir.has(directionId)) byDir.set(directionId, new Set());

    // GTFS times can exceed 24:00 for runs past midnight
    const [h, m] = st.arrival_time.split(":").map(Number);
    byDir.get(directionId)!.add(h * 60 + m);

    if (st.trip_id === dirRepTrip[directionId]) {
      stopOrder[directionId].push({
        stopId,
        sequence: parseInt(st.stop_sequence),
      });
    }
  });

  // Build ordered stop lists per direction
  const orderedStops: Record<
    number,
    { stopId: string; stopName: string; lat: number; lon: number }[]
  > = {};
  for (const dir of [0, 1]) {
    orderedStops[dir] = stopOrder[dir]
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ stopId }) => {
        const info = stopMap.get(stopId);
        return {
          stopId,
          stopName: info?.name ?? stopId,
          lat: info?.lat ?? 0,
          lon: info?.lon ?? 0,
        };
      });
  }

  // Headsigns per direction
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

  return NextResponse.json({
    stops: orderedStops,
    schedule: scheduleOut,
    headsigns,
  });
}
