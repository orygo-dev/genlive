"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, PlugZap, Save } from "lucide-react";

type IntegrationsView = Record<string, string | boolean | string[] | null | undefined>;

export function AdminIntegrationsPanel() {
  const [data, setData] = useState<IntegrationsView | null>(null);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations");
      const payload = (await response.json()) as {
        integrations?: IntegrationsView;
        encryptionConfigured?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.integrations) {
        throw new Error(payload.error ?? "Gagal memuat integrasi.");
      }
      setData(payload.integrations);
      setEncryptionConfigured(Boolean(payload.encryptionConfigured));
      setForm({
        appUrl: String(payload.integrations.appUrl || ""),
        livekitUrl: String(payload.integrations.livekitUrl || ""),
        livekitApiUrl: String(payload.integrations.livekitApiUrl || ""),
        livekitApiKey: "",
        livekitApiSecret: "",
        emailFrom: String(payload.integrations.emailFrom || ""),
        resendApiKey: "",
        fonnteToken: "",
        fonnteCountryCode: String(payload.integrations.fonnteCountryCode || "62"),
        paymentProvider: String(payload.integrations.paymentProvider || "MIDTRANS"),
        midtransServerKey: "",
        midtransClientKey: "",
        midtransIsProduction: payload.integrations.midtransIsProduction ? "true" : "false",
        ipaymuVa: String(payload.integrations.ipaymuVa || ""),
        ipaymuApiKey: "",
        ipaymuIsProduction: payload.integrations.ipaymuIsProduction ? "true" : "false",
        flipSecretKey: "",
        flipValidationToken: "",
        flipIsProduction: payload.integrations.flipIsProduction ? "true" : "false",
        cronSecret: "",
        googleClientId: String(payload.integrations.googleClientId || ""),
        googleClientSecret: "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        appUrl: form.appUrl || null,
        livekitUrl: form.livekitUrl || null,
        livekitApiUrl: form.livekitApiUrl || null,
        emailFrom: form.emailFrom || null,
        fonnteCountryCode: form.fonnteCountryCode || "62",
        paymentProvider: form.paymentProvider || null,
        midtransIsProduction: form.midtransIsProduction === "true",
        ipaymuVa: form.ipaymuVa || null,
        ipaymuIsProduction: form.ipaymuIsProduction === "true",
        flipIsProduction: form.flipIsProduction === "true",
      };
      if (form.livekitApiKey.trim()) body.livekitApiKey = form.livekitApiKey.trim();
      if (form.livekitApiSecret.trim()) body.livekitApiSecret = form.livekitApiSecret.trim();
      if (form.resendApiKey.trim()) body.resendApiKey = form.resendApiKey.trim();
      if (form.fonnteToken.trim()) body.fonnteToken = form.fonnteToken.trim();
      if (form.midtransServerKey.trim()) body.midtransServerKey = form.midtransServerKey.trim();
      if (form.midtransClientKey.trim()) body.midtransClientKey = form.midtransClientKey.trim();
      if (form.ipaymuApiKey.trim()) body.ipaymuApiKey = form.ipaymuApiKey.trim();
      if (form.flipSecretKey.trim()) body.flipSecretKey = form.flipSecretKey.trim();
      if (form.flipValidationToken.trim()) body.flipValidationToken = form.flipValidationToken.trim();
      if (form.cronSecret.trim()) body.cronSecret = form.cronSecret.trim();
      if (form.googleClientId.trim()) body.googleClientId = form.googleClientId.trim();
      if (form.googleClientSecret.trim()) {
        body.googleClientSecret = form.googleClientSecret.trim();
      }

      const response = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gagal menyimpan.");
      setMessage("Konfigurasi integrasi disimpan.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function testLivekit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/test-livekit", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Tes LiveKit gagal.");
      }
      setMessage(payload.message || "LiveKit OK.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Tes gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h2>Integrasi platform</h2>
          <p className="admin-muted">
            LiveKit, email, WhatsApp, payment — tersimpan terenkripsi di database.
          </p>
        </div>
        <PlugZap size={18} />
      </div>

      {!encryptionConfigured ? (
        <p className="form-error">
          Set `APP_ENCRYPTION_KEY` di `.env.production` lalu restart PM2 sebelum
          menyimpan secret dari UI.
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <form className="admin-integrations-form" onSubmit={onSubmit}>
        <fieldset>
          <legend>Aplikasi</legend>
          <label>
            APP_URL
            <input value={form.appUrl || ""} onChange={(e) => setField("appUrl", e.target.value)} placeholder="https://domainanda.com" />
          </label>
          <label>
            CRON_SECRET {data?.cronSecretSet ? "(tersimpan)" : ""}
            <input value={form.cronSecret || ""} onChange={(e) => setField("cronSecret", e.target.value)} placeholder="Kosongkan jika tidak diubah" type="password" />
          </label>
        </fieldset>

        <fieldset>
          <legend>LiveKit</legend>
          <label>
            LIVEKIT_URL (wss://)
            <input value={form.livekitUrl || ""} onChange={(e) => setField("livekitUrl", e.target.value)} />
          </label>
          <label>
            LIVEKIT_API_URL (opsional https://)
            <input value={form.livekitApiUrl || ""} onChange={(e) => setField("livekitApiUrl", e.target.value)} />
          </label>
          <label>
            API Key {data?.livekitApiKeySet ? "(tersimpan)" : ""}
            <input value={form.livekitApiKey || ""} onChange={(e) => setField("livekitApiKey", e.target.value)} type="password" placeholder="Kosongkan jika tidak diubah" />
          </label>
          <label>
            API Secret {data?.livekitApiSecretSet ? "(tersimpan)" : ""}
            <input value={form.livekitApiSecret || ""} onChange={(e) => setField("livekitApiSecret", e.target.value)} type="password" placeholder="Kosongkan jika tidak diubah" />
          </label>
          <button type="button" className="button button-ghost" disabled={busy} onClick={() => void testLivekit()}>
            Tes koneksi LiveKit
          </button>
        </fieldset>

        <fieldset>
          <legend>Email (Resend)</legend>
          <label>
            EMAIL_FROM
            <input value={form.emailFrom || ""} onChange={(e) => setField("emailFrom", e.target.value)} />
          </label>
          <label>
            RESEND_API_KEY {data?.resendApiKeySet ? "(tersimpan)" : ""}
            <input value={form.resendApiKey || ""} onChange={(e) => setField("resendApiKey", e.target.value)} type="password" placeholder="Kosongkan jika tidak diubah" />
          </label>
        </fieldset>

        <fieldset>
          <legend>WhatsApp (Fonnte)</legend>
          <label>
            FONNTE_TOKEN {data?.fonnteTokenSet ? "(tersimpan)" : ""}
            <input value={form.fonnteToken || ""} onChange={(e) => setField("fonnteToken", e.target.value)} type="password" placeholder="Kosongkan jika tidak diubah" />
          </label>
          <label>
            Country code
            <input value={form.fonnteCountryCode || "62"} onChange={(e) => setField("fonnteCountryCode", e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <label>
            Provider default
            <select value={form.paymentProvider || "MIDTRANS"} onChange={(e) => setField("paymentProvider", e.target.value)}>
              <option value="MIDTRANS">MIDTRANS</option>
              <option value="IPAYMU">IPAYMU</option>
              <option value="FLIP">FLIP</option>
            </select>
          </label>
          <label>
            Midtrans server key {data?.midtransServerKeySet ? "(tersimpan)" : ""}
            <input value={form.midtransServerKey || ""} onChange={(e) => setField("midtransServerKey", e.target.value)} type="password" />
          </label>
          <label>
            Midtrans client key {data?.midtransClientKeySet ? "(tersimpan)" : ""}
            <input value={form.midtransClientKey || ""} onChange={(e) => setField("midtransClientKey", e.target.value)} type="password" />
          </label>
          <label>
            Midtrans production
            <select value={form.midtransIsProduction || "false"} onChange={(e) => setField("midtransIsProduction", e.target.value)}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            iPaymu VA
            <input value={form.ipaymuVa || ""} onChange={(e) => setField("ipaymuVa", e.target.value)} />
          </label>
          <label>
            iPaymu API key {data?.ipaymuApiKeySet ? "(tersimpan)" : ""}
            <input value={form.ipaymuApiKey || ""} onChange={(e) => setField("ipaymuApiKey", e.target.value)} type="password" />
          </label>
          <label>
            Flip secret {data?.flipSecretKeySet ? "(tersimpan)" : ""}
            <input value={form.flipSecretKey || ""} onChange={(e) => setField("flipSecretKey", e.target.value)} type="password" />
          </label>
          <label>
            Flip validation token {data?.flipValidationTokenSet ? "(tersimpan)" : ""}
            <input value={form.flipValidationToken || ""} onChange={(e) => setField("flipValidationToken", e.target.value)} type="password" />
          </label>
        </fieldset>

        <fieldset>
          <legend>Google OAuth</legend>
          <p className="admin-muted">
            Alternatif env: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Redirect URI:
            {" "}
            <code>{`${form.appUrl || "https://domainanda.com"}/api/auth/google/callback`}</code>
          </p>
          <label>
            GOOGLE_CLIENT_ID
            <input
              value={form.googleClientId || ""}
              onChange={(e) => setField("googleClientId", e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </label>
          <label>
            GOOGLE_CLIENT_SECRET {data?.googleClientSecretSet ? "(tersimpan)" : ""}
            <input
              value={form.googleClientSecret || ""}
              onChange={(e) => setField("googleClientSecret", e.target.value)}
              type="password"
              placeholder="Kosongkan jika tidak diubah"
            />
          </label>
        </fieldset>

        <button className="button" type="submit" disabled={busy || !encryptionConfigured}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          Simpan integrasi
        </button>
      </form>
    </section>
  );
}
