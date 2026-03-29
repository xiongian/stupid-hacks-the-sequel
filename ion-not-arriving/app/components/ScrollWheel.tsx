"use client";

import { useRef, useEffect } from "react";

interface ScrollWheelProps {
  times: string[];
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

export default function ScrollWheel({ times }: ScrollWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [times]);

  if (times.length === 0) return null;

  const containerHeight = ITEM_HEIGHT * VISIBLE_ITEMS;
  const padding = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

  return (
    <div className="relative w-full select-none" style={{ height: containerHeight }}>
      {/* Fade top — blends into #006BB7 sidebar */}
      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{
          height: padding,
          background: "linear-gradient(to bottom, #006BB7 40%, transparent)",
        }}
      />
      {/* Highlight band — #FFD100 yellow border, slightly lighter blue fill */}
      <div
        className="absolute inset-x-0 z-10 pointer-events-none"
        style={{
          top: padding,
          height: ITEM_HEIGHT,
          borderTop: "2px solid #FFD100",
          borderBottom: "2px solid #FFD100",
          background: "rgba(255, 255, 255, 0.1)",
        }}
      />
      {/* Fade bottom */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{
          height: padding,
          background: "linear-gradient(to top, #006BB7 40%, transparent)",
        }}
      />

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll"
        style={{
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div style={{ height: padding }} />

        {times.map((time) => (
          <div
            key={time}
            className="flex items-center justify-center font-mono text-lg"
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center", color: "#FFFFFF" }}
          >
            {time}
          </div>
        ))}

        <div style={{ height: padding }} />
      </div>
    </div>
  );
}
