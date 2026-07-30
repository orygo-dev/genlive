"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Segoe UI, sans-serif",
          background: "#f5f7fb",
          color: "#172033",
        }}
      >
        <main style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Terjadi gangguan</h1>
          <p style={{ color: "#667085", marginBottom: 20 }}>
            Aplikasi GenMeet mengalami kesalahan tak terduga.
            {error.digest ? ` Kode: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "12px 18px",
              background: "#2d8cff",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
