"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* The masterpiece, covering the full viewport */}
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
        }}
      >
        <img
          src="/stupid_front_page.png"
          alt="ion know. :("
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>

      {/* The buttons */}
      <div
        style={{
          padding: "4rem 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          background: "#fff",
        }}
      >
        <p style={{ color: "#999", fontStyle: "italic", fontSize: "0.875rem" }}>
          do you wanna know when the ion arrives?
        </p>

        <div style={{ display: "flex", gap: "1.5rem" }}>
          {/* The green button that reloads the page — maximum frustration */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "1rem 2.5rem",
              borderRadius: "0.5rem",
              fontSize: "1.25rem",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
          >
            i wanna know
          </button>

          {/* The red button that actually works */}
          <Link
            href="/travel"
            style={{
              background: "#dc2626",
              color: "#fff",
              padding: "1rem 2.5rem",
              borderRadius: "0.5rem",
              fontSize: "1.25rem",
              fontWeight: "bold",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            ion wanna know
          </Link>
        </div>
      </div>
    </main>
  );
}
