"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="invite-page">
      <section className="invite-card">
        <h1>Halaman bermasalah</h1>
        <p>
          Kami tidak dapat menampilkan halaman ini saat ini.
          {error.digest ? ` Kode: ${error.digest}` : ""}
        </p>
        <div className="hero-actions" style={{ marginTop: 8 }}>
          <button type="button" className="button button-primary" onClick={() => reset()}>
            Coba lagi
          </button>
          <Link className="button button-ghost" href="/">
            Ke beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
