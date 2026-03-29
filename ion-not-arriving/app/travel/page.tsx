"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Station } from "../components/IonMap";
import PaginatedDropdown from "../components/PaginatedDropdown";
import Link from "next/link";

const IonMap = dynamic(() => import("../components/IonMap"), { ssr: false });

interface ScheduleData {
  stations: Station[];
  schedule: Record<string, Record<number, number[]>>;
  headsigns: Record<number, string>;
  routePaths: Record<number, [number, number][]>;
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

const MODE_BUTTONS: { id: string; label: string }[] = [
  { id: "ik", label: "ik (ion know)" },
  { id: "idk", label: "idk (ion don't know)" },
  { id: "2016", label: "#2016" },
];

function Logo() {
  return (
    <img
      src="/stupid_hacks_logo.png"
      alt="Stupid Hacks Logo"
      className="h-12"
    />
  );
}

/* ──────────────────────────────────────────────
   TUTORIAL OVERLAY
   ────────────────────────────────────────────── */
function TutorialOverlay({ onDismiss, onExit }: { onDismiss: () => void; onExit: () => void }) {
  return (
    <div
      onClick={onExit}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "pointer",
      }}
    >
      {/* Dim layer */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />

      {/* Spotlight cutout — transparent so clicks pass through to the real mode buttons */}
      <div
        id="tutorial-spotlight"
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          width: 420,
          height: 52,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
          background: "transparent",
          zIndex: 10000,
          pointerEvents: "none",
          border: "2px solid #FFD100",
          animation: "pulse-border 1.5s ease-in-out infinite",
        }}
      />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: #FFD100; box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 8px rgba(255,209,0,0.4); }
          50% { border-color: #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 16px rgba(255,209,0,0.8); }
        }
      `}</style>

      {/* Callout arrow + text */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 66,
          right: 24,
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        {/* Arrow */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderBottom: "14px solid #FFD100",
            marginRight: 40,
          }}
        />
        {/* Tooltip box */}
        <div
          style={{
            background: "#FFD100",
            color: "#1A1A2E",
            padding: "16px 20px",
            borderRadius: 8,
            maxWidth: 340,
            fontWeight: "bold",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: "1rem", marginBottom: 8 }}>
            welcome to ion not arriving!
          </div>
          <div style={{ fontWeight: "normal", fontSize: "0.8rem" }}>
            select a travel mode and click on a station to start planning your trip in waterloo.
          </div>
          <div style={{ marginTop: 14, fontSize: "0.7rem", color: "#666", textAlign: "center" }}>
            click anywhere to exit
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MODE: ik — "ion know"
   ────────────────────────────────────────────── */
function IonKnowPanel({ station }: { station: Station | undefined }) {
  if (!station) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-center p-8"
        style={{ color: "#FFFFFF" }}
      >
        Select a station on the map to find out what we know.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <div
        className="px-4 py-3 w-full"
        style={{ borderBottom: "3px solid #FFD100" }}
      >
        <div className="font-bold text-base" style={{ color: "#FFFFFF" }}>
          {station.name}
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 flex-1 justify-center">
        <div style={{ fontSize: "4rem" }}>:(</div>
        <div
          className="text-2xl font-bold text-center"
          style={{ color: "#FFD100" }}
        >
          ion know
        </div>
        <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
          We simply do not know. Nobody knows. The Ion works in mysterious ways.
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MODE: idk — "ion don't know"
   ────────────────────────────────────────────── */
function IonDontKnowPanel({
  station,
  direction,
  setDirection,
  availableDirections,
  headsigns,
  notArrivingTimes,
}: {
  station: Station | undefined;
  direction: number | null;
  setDirection: (d: number) => void;
  availableDirections: number[];
  headsigns: Record<number, string>;
  notArrivingTimes: string[];
}) {
  if (!station) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-center p-8"
        style={{ color: "#FFFFFF" }}
      >
        Select a station on the map to see when the ION will not arrive.
      </div>
    );
  }

  return (
    <>
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "3px solid #FFD100" }}
      >
        <div className="font-bold text-base" style={{ color: "#FFFFFF" }}>
          {station.name}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "#FFD100" }}>
          Select a direction
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4 shrink-0">
        {availableDirections.map((dir) => (
          <button
            key={dir}
            onClick={() => setDirection(dir)}
            className="py-2 px-3 text-sm font-medium text-left transition-colors"
            style={
              direction === dir
                ? { background: "#FFD100", color: "#006BB7", border: "2px solid #FFD100" }
                : { background: "transparent", color: "#FFFFFF", border: "2px solid #FFFFFF" }
            }
          >
            → {headsigns[dir] ?? `Direction ${dir}`}
          </button>
        ))}
      </div>

      {direction !== null && (
        <div className="flex flex-col flex-1 px-4 pb-4">
          <PaginatedDropdown times={notArrivingTimes} />
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────
   MODE: 2016 — the Ion doesn't exist yet
   ────────────────────────────────────────────── */
function Panel2016() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div style={{ fontSize: "3rem" }}>🚌</div>
      <div className="text-lg font-bold" style={{ color: "#FFD100" }}>
        it&apos;s 2016
      </div>
      <div className="text-sm" style={{ color: "#FFFFFF" }}>
        the ion doesn&apos;t exist yet
      </div>
      <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 200 }}>
        construction is ongoing. your commute is ruined by roadwork instead. take the 200 iXpress
        and cope.
      </div>
      <div className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        estimated completion: 2018
      </div>
      <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
        (it opened in 2019 lol)
      </div>
    </div>
  );
}

function TravelPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get("mode") ?? "idk";

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [direction, setDirection] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("ion-tutorial-seen");
    if (!seen) {
      setShowTutorial(true);
    }
  }, []);

  function dismissTutorial() {
    setShowTutorial(false);
    sessionStorage.setItem("ion-tutorial-seen", "1");
  }

  function exitTutorial() {
    sessionStorage.setItem("ion-tutorial-seen", "1");
    router.push("/");
  }

  useEffect(() => {
    if (mode === "2016") {
      setLoading(false);
      return;
    }
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load schedule data."); setLoading(false); });
  }, [mode]);

  const headsigns = data?.headsigns ?? {};
  const selectedStation = data?.stations.find((s) => s.id === selectedStationId);

  const availableDirections = selectedStation
    ? Object.keys(selectedStation.stopIds).map(Number)
    : [];

  const rawMinutes =
    selectedStation && direction !== null && data
      ? data.schedule[String(selectedStation.stopIds[direction])]?.[direction]
      : undefined;
  const arrivalMinutes: number[] = Array.isArray(rawMinutes) ? rawMinutes : [];

  const notArrivingTimes =
    selectedStation && direction !== null ? getNotArrivingTimes(arrivalMinutes) : [];

  function handleStationSelect(id: string) {
    setSelectedStationId(id);
    setDirection(null);
  }

  const is2016 = mode === "2016";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFFFFF", color: "#006BB7" }}>
      {showTutorial && <TutorialOverlay onDismiss={dismissTutorial} onExit={exitTutorial} />}

      {/* Header — white bg with blue text and yellow accent */}
      <header
        className="flex items-center gap-4 px-6 py-3 shrink-0"
        style={{ background: "#FFFFFF", borderBottom: "4px solid #FFD100" }}
      >
        <Logo />
        <div className="flex-1">
          <div className="font-bold text-xl" style={{ color: "#006BB7" }}>
            ion know
          </div>
          <div className="text-xs" style={{ color: "#FFD100" }}>
            Waterloo Region&apos;s most useless transit planner
          </div>
        </div>

        {/* Mode tabs — z-index above tutorial overlay so clicks pass through */}
        <div className="flex items-center gap-2" style={{ position: "relative", zIndex: showTutorial ? 10001 : "auto" }}>
          <span className="text-xs font-medium" style={{ color: "#FFD100" }}>
            travel modes:
          </span>
          {MODE_BUTTONS.map((m) => (
            <Link
              key={m.id}
              href={`/travel?mode=${m.id}`}
              onClick={showTutorial ? dismissTutorial : undefined}
              className="px-3 py-1.5 text-xs font-bold rounded transition-colors whitespace-nowrap"
              style={
                mode === m.id
                  ? { background: "#FFD100", color: "#006BB7" }
                  : { background: "transparent", color: "#006BB7", border: "1px solid rgba(0,107,183,0.3)" }
              }
            >
              {m.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {loading && !is2016 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-sm"
              style={{ background: "#FFFFFF", color: "#006BB7" }}
            >
              Loading ION schedule…
            </div>
          )}
          {error && (
            <div
              className="absolute inset-0 flex items-center justify-center text-sm p-8 text-center"
              style={{ background: "#FFFFFF", color: "#006BB7" }}
            >
              {error}
            </div>
          )}

          {is2016 ? (
            <IonMap
              stations={[]}
              routePaths={{}}
              selectedStationId=""
              onStationSelect={() => {}}
            />
          ) : (
            !loading && !error && data && (
              <IonMap
                stations={data.stations}
                routePaths={data.routePaths}
                selectedStationId={selectedStationId}
                onStationSelect={handleStationSelect}
              />
            )
          )}

          {!is2016 && !selectedStationId && !loading && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 pointer-events-none"
              style={{ background: "#006BB7", color: "#FFFFFF" }}
            >
              Click a station
            </div>
          )}
        </div>

        {/* Side panel — blue bg */}
        <div
          className="w-72 shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: "3px solid #FFD100", background: "#006BB7" }}
        >
          {is2016 ? (
            <Panel2016 />
          ) : mode === "ik" ? (
            <IonKnowPanel station={selectedStation} />
          ) : (
            <IonDontKnowPanel
              station={selectedStation}
              direction={direction}
              setDirection={setDirection}
              availableDirections={availableDirections}
              headsigns={headsigns}
              notArrivingTimes={notArrivingTimes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function TravelPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#FFFFFF", color: "#006BB7" }}
        >
          Loading…
        </div>
      }
    >
      <TravelPageInner />
    </Suspense>
  );
}
