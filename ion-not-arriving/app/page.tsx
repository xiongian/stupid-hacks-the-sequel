"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { StopMarker } from "./components/IonMap";

const IonMap = dynamic(() => import("./components/IonMap"), { ssr: false });

interface Stop {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
}

interface ScheduleData {
  stops: Record<number, Stop[]>;
  schedule: Record<string, Record<number, number[]>>;
  headsigns: Record<number, string>;
}

function cleanStopName(name: string): string {
  return name.replace(/ - (Northbound|Southbound|Eastbound|Westbound)$/i, "");
}

function minutesToDisplay(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getNotArrivingTimes(arrivalMinutes: number[], windowHours = 2): string[] {
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const windowEnd = currentMinute + windowHours * 60;
  const arrivingSet = new Set(arrivalMinutes);
  const notArriving: string[] = [];
  for (let min = currentMinute; min < windowEnd; min++) {
    if (!arrivingSet.has(min % (24 * 60))) {
      notArriving.push(minutesToDisplay(min));
    }
  }
  return notArriving;
}

export default function Home() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [direction, setDirection] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load schedule data."); setLoading(false); });
  }, []);

  const allStops = data?.stops[0] ?? [];
  const headsigns = data?.headsigns ?? {};

  const mapStops: StopMarker[] = useMemo(() => allStops, [allStops]);

  const availableDirections = selectedStopId && data
    ? Object.keys(data.schedule[selectedStopId] ?? {}).map(Number)
    : [];

  const arrivalMinutes = selectedStopId && direction !== null && data
    ? (data.schedule[selectedStopId]?.[direction] ?? [])
    : [];

  const notArrivingTimes = selectedStopId && direction !== null
    ? getNotArrivingTimes(arrivalMinutes)
    : [];

  const selectedStop = allStops.find((s) => s.stopId === selectedStopId);

  function handleStopSelect(stopId: string) {
    setSelectedStopId(stopId);
    setDirection(null);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-4xl font-bold text-red-400 mb-1">Ion Not Arriving</h1>
        <p className="text-gray-400">
          The transit planner that tells you when the Ion will{" "}
          <span className="line-through text-gray-600">arrive</span>{" "}
          <span className="text-red-400 font-semibold">NOT arrive</span>.
          {!selectedStopId && !loading && (
            <span className="text-gray-500 ml-2">Click a stop to get started.</span>
          )}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-0 px-8 pb-8" style={{ minHeight: 0 }}>
        {/* Map */}
        <div className="flex-1 rounded-lg overflow-hidden" style={{ height: "70vh" }}>
          {loading && (
            <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center text-gray-400 animate-pulse">
              Loading Ion schedule data...
            </div>
          )}
          {error && (
            <div className="w-full h-full bg-red-950 border border-red-800 rounded-lg flex items-center justify-center text-red-400 p-8">
              {error}
            </div>
          )}
          {!loading && !error && (
            <IonMap
              stops={mapStops}
              selectedStopId={selectedStopId}
              onStopSelect={handleStopSelect}
            />
          )}
        </div>

        {/* Side panel */}
        {selectedStopId && (
          <div className="w-80 ml-6 flex flex-col gap-4 overflow-y-auto">
            <div>
              <h2 className="text-lg font-bold text-white">
                {cleanStopName(selectedStop?.stopName ?? "")}
              </h2>
              <p className="text-gray-500 text-sm">Select a direction</p>
            </div>

            {/* Direction buttons */}
            <div className="flex flex-col gap-2">
              {availableDirections.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  className={`py-3 px-4 rounded-lg border font-medium transition-colors text-left ${
                    direction === dir
                      ? "bg-red-700 border-red-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  → {headsigns[dir] ?? `Direction ${dir}`}
                </button>
              ))}
            </div>

            {direction !== null && (
              <>
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">
                    Times the Ion will{" "}
                    <span className="text-red-400 font-bold">NOT</span> arrive
                  </p>
                  <p className="text-gray-600 text-xs">
                    Next 2 hrs · {notArrivingTimes.length} non-arrivals
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {notArrivingTimes.map((time) => (
                    <div
                      key={time}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-center text-xs text-gray-300"
                    >
                      {time}
                    </div>
                  ))}
                </div>
                <p className="text-gray-700 text-xs italic">
                  * Based on the official GRT GTFS schedule.
                  The Ion may also not arrive at scheduled times.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
