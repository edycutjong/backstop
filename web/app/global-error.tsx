"use client";

// Last-resort boundary: catches errors in the root layout itself. Must render
// its own <html>/<body> because it replaces the whole document tree. Kept
// dependency-free (inline styles) so it works even if the app shell failed.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0f14",
          color: "#e9edf2",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          Backstop failed to load.
        </h1>
        <p style={{ maxWidth: 420, color: "#94a3b8", lineHeight: 1.6 }}>
          An unexpected error broke the app shell. Nothing on-chain was
          affected. Reload to try again.
        </p>
        {error?.digest && (
          <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.65rem 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#3ecf9a",
            color: "#0a0f14",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ↻ Reload
        </button>
      </body>
    </html>
  );
}
