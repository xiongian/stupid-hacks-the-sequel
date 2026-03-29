"use client";

import { useState } from "react";

interface PaginatedDropdownProps {
  times: string[];
}

const PAGE_SIZE = 5;

export default function PaginatedDropdown({ times }: PaginatedDropdownProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  if (times.length === 0) return null;

  const totalPages = Math.ceil(times.length / PAGE_SIZE);
  const pageItems = times.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSelect(time: string) {
    setSelected(time);
    setOpen(false);
  }

  return (
    <div className="w-full font-mono text-sm" style={{ color: "#FFFFFF" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "2px solid #FFD100",
          color: "#FFFFFF",
        }}
      >
        <span>{"NOT Arriving At"}</span>
        <span style={{ color: "#FFD100" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            border: "2px solid #FFD100",
            borderTop: "none",
            background: "#005a9e",
          }}
        >
          {/* Page items */}
          {pageItems.map((time) => (
            <button
              key={time}
              onClick={() => handleSelect(time)}
              className="w-full text-left px-3 py-2 block transition-colors"
              style={
                time === selected
                  ? { background: "#FFD100", color: "#006BB7" }
                  : { color: "#FFFFFF" }
              }
              onMouseEnter={(e) => {
                if (time !== selected) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (time !== selected) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              {time}
            </button>
          ))}

          {/* Pagination */}
          <div
            className="flex items-center justify-between px-3 py-2 text-xs"
            style={{ borderTop: "1px solid rgba(255,209,0,0.4)", color: "#FFD100" }}
          >
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ opacity: page === 0 ? 0.3 : 1 }}
            >
              ← Prev
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ opacity: page === totalPages - 1 ? 0.3 : 1 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
