import { NextResponse } from "next/server";
import JSZip from "jszip";

const GTFS_URL =
  "https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/2";

export async function GET() {
  const response = await fetch(GTFS_URL, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: `Fetch failed: ${response.status}` });
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const files = Object.keys(zip.files);

  const routesRaw = await zip.file("routes.txt")?.async("string") ?? "(missing)";
  const tripsFirst5 = (await zip.file("trips.txt")?.async("string") ?? "")
    .split("\n").slice(0, 6).join("\n");
  const stopsFirst5 = (await zip.file("stops.txt")?.async("string") ?? "")
    .split("\n").slice(0, 6).join("\n");

  return NextResponse.json({
    files,
    routes_txt: routesRaw,
    trips_first5: tripsFirst5,
    stops_first5: stopsFirst5,
  });
}
