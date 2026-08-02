"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, PlugZap, Save, Wifi } from "lucide-react";
import {
  isValidLivekitUrl,
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
} from "@/lib/livekit-url";

type IntegrationsView = Record<
  string,
  string | boolean | string[] | null | undefined
>;

async function readApiJson<T extends { error?: string }>(
  response: Response,
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 404
        ? "API integrasi tidak ditemukan (404). Deploy ulang: bash scripts/aapanel-pm2.sh --build"
        : response.status === 502 || response.status === 503
          ? `Server/PM2 tidak merespons (${response.status}). Cek: pm2 status genmeet`
          : `Server mengembalikan HTML (status ${response.status}), bukan JSON. Cek proxy ke port 3010.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Respons API tidak valid (status ${response.status}). Cek pm2 logs genmeet.`,
    );
  }
}

export function AdminIntegrationsPanel() {
  const [data, setData] = useState<IntegrationsView | null>(null);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [livekitReady, setLivekitReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const livekitStatus = useMemo(() => {
    const urlOk = isValidLivekitUrl(form.livekitUrl);
    const keyOk = Boolean(form.livekitApiKey?.trim() || data?.livekitApiKeySet);
    const secretOk = Boolean(
      form.livekitApiSecret?.trim() || data?.livekitApiSecretSet,
    );
    return { urlOk, keyOk, secretOk, ready: urlOk && keyOk && secretOk };
  }, [form.livekitUrl, form.livekitApiKey, form.livekitApiSecret, data]);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations");
      const payload = await readApiJson<{
        integrations?: IntegrationsView;
        encryptionConfigured?: boolean;
        livekitReady?: boolean;
        error?: string;
      }>(response);
      if (!response.ok || !payload.integrations) {
        throw new Error(payload.error ?? "Gagal memuat integrasi.");
      }
      setData(payload.integrations);
      setEncryptionConfigured(Boolean(payload.encryptionConfigured));
      setLivekitReady(Boolean(payload.livekitReady));
      setForm({
        appUrl: String(payload.integrations.appUrl || ""),
        livekitUrl: String(payload.integrations.livekitUrl || ""),
        livekitApiUrl: String(payload.integrations.livekitApiUrl || ""),
        livekitApiKey: "",
        livekitApiSecret: "",
        emailFrom: String(payload.integrations.emailFrom || ""),
        resendApiKey: "",
        fonnteToken: "",
        fonnteCountryCode: String(
          payload.integrations.fonnteCountryCode || "62",
        ),
        paymentProvider: String(
          payload.integrations.paymentProvider || "MIDTRANS",
        ),
        midtransServerKey: "",
        midtransClientKey: "",
        midtransIsProduction: payload.integrations.midtransIsProduction
          ? "true"
          : "false",
        ipaymuVa: String(payload.integrations.ipaymuVa || ""),
        ipaymuApiKey: "",
        ipaymuIsProduction: payload.integrations.ipaymuIsProduction
          ? "true"
          : "false",
        flipSecretKey: "",
        flipValidationToken: "",
        flipIsProduction: payload.integrations.flipIsProduction
          ? "true"
          : "false",
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

  function normalizeLivekitFields() {
    const url = normalizeLivekitUrl(form.livekitUrl) || "";
    const apiUrl =
      normalizeLivekitApiUrl(form.livekitApiUrl, url) || form.livekitApiUrl || "";
    setForm((prev) => ({
      ...prev,
      livekitUrl: url,
      livekitApiUrl: apiUrl,
    }));
    return { url, apiUrl };
  }

  async function saveIntegrations(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await readApiJson<{ error?: string; livekitReady?: boolean }>(
      response,
    );
    if (!response.ok) throw new Error(payload.error ?? "Gagal menyimpan.");
    if (typeof payload.livekitReady === "boolean") {
      setLivekitReady(payload.livekitReady);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { url, apiUrl } = normalizeLivekitFields();
      if (form.livekitUrl.trim() && !isValidLivekitUrl(url)) {
        throw new Error(
          "LIVEKIT_URL tidak valid. Gunakan wss://xxxx.livekit.cloud dari dashboard Cloud.",
        );
      }

      const body: Record<string, unknown> = {
        appUrl: form.appUrl || null,
        livekitUrl: url || null,
        livekitApiUrl: apiUrl || null,
        emailFrom: form.emailFrom || null,
        fonnteCountryCode: form.fonnteCountryCode || "62",
        paymentProvider: form.paymentProvider || null,
        midtransIsProduction: form.midtransIsProduction === "true",
        ipaymuVa: form.ipaymuVa || null,
        ipaymuIsProduction: form.ipaymuIsProduction === "true",
        flipIsProduction: form.flipIsProduction === "true",
      };
      if (form.livekitApiKey.trim()) body.livekitApiKey = form.livekitApiKey.trim();
      if (form.livekitApiSecret.trim()) {
        body.livekitApiSecret = form.livekitApiSecret.trim();
      }
      if (form.resendApiKey.trim()) body.resendApiKey = form.resendApiKey.trim();
      if (form.fonnteToken.trim()) body.fonnteToken = form.fonnteToken.trim();
      if (form.midtransServerKey.trim()) {
        body.midtransServerKey = form.midtransServerKey.trim();
      }
      if (form.midtransClientKey.trim()) {
        body.midtransClientKey = form.midtransClientKey.trim();
      }
      if (form.ipaymuApiKey.trim()) body.ipaymuApiKey = form.ipaymuApiKey.trim();
      if (form.flipSecretKey.trim()) body.flipSecretKey = form.flipSecretKey.trim();
      if (form.flipValidationToken.trim()) {
        body.flipValidationToken = form.flipValidationToken.trim();
      }
      if (form.cronSecret.trim()) body.cronSecret = form.cronSecret.trim();
      if (form.googleClientId.trim()) {
        body.googleClientId = form.googleClientId.trim();
      }
      if (form.googleClientSecret.trim()) {
        body.googleClientSecret = form.googleClientSecret.trim();
      }

      await saveIntegrations(body);
      setMessage("Konfigurasi tersimpan.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLivekitOnly() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { url, apiUrl } = normalizeLivekitFields();
      if (!isValidLivekitUrl(url)) {
        throw new Error(
          "Isi LIVEKIT_URL dengan wss://xxxx.livekit.cloud dari LiveKit Cloud.",
        );
      }
      if (!form.livekitApiKey.trim() && !data?.livekitApiKeySet) {
        throw new Error("Isi API Key LiveKit.");
      }
      if (!form.livekitApiSecret.trim() && !data?.livekitApiSecretSet) {
        throw new Error("Isi API Secret LiveKit.");
      }

      const body: Record<string, unknown> = {
        livekitUrl: url,
        livekitApiUrl: apiUrl || null,
      };
      if (form.livekitApiKey.trim()) body.livekitApiKey = form.livekitApiKey.trim();
      if (form.livekitApiSecret.trim()) {
        body.livekitApiSecret = form.livekitApiSecret.trim();
      }

      await saveIntegrations(body);
      setMessage("Pengaturan LiveKit tersimpan. Silakan uji koneksi.");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Gagal menyimpan LiveKit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testLivekit() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/test-livekit", {
        method: "POST",
      });
      const payload = await readApiJson<{
        ok?: boolean;
        message?: string;
        error?: string;
        host?: string;
      }>(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Tes LiveKit gagal.");
      }
      setLivekitReady(true);
      setMessage(payload.message || "LiveKit OK.");
    } catch (testError) {
      setLivekitReady(false);
      setError(testError instanceof Error ? testError.message : "Tes gagal.");
    } finally {
      setTesting(false);
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
          Enkripsi belum siap di server. Pastikan database terhubung, lalu restart
          PM2.
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <form className="admin-integrations-form" onSubmit={onSubmit}>
        <fieldset className="admin-livekit-fieldset">
          <legend>LiveKit Cloud</legend>
          <div className="admin-livekit-status">
            {livekitReady || livekitStatus.ready ? (
              <span className="admin-livekit-badge is-ok">
                <CheckCircle2 size={14} /> Siap dipakai
              </span>
            ) : (
              <span className="admin-livekit-badge is-warn">
                <Wifi size={14} /> Belum lengkap
              </span>
            )}
            {data?.livekitStoredInDatabase ? (
              <span className="admin-muted">Tersimpan di database</span>
            ) : (
              <span className="admin-muted">Belum tersimpan di database</span>
            )}
          </div>
          <p className="admin-muted">
            Dari dashboard LiveKit Cloud salin <strong>WebSocket URL</strong>{" "}
            (<code>wss://…</code>), <strong>API Key</strong>, dan{" "}
            <strong>API Secret</strong>. URL <code>https://</code> akan
            dikonversi otomatis ke <code>wss://</code>.
          </p>
          <label>
            LIVEKIT_URL (wss://)
            <input
              value={form.livekitUrl || ""}
              onChange={(e) => setField("livekitUrl", e.target.value)}
              onBlur={() => normalizeLivekitFields()}
              placeholder="wss://your-project.livekit.cloud"
              autoComplete="off"
              spellCheck={false}
            />
            {!livekitStatus.urlOk && form.livekitUrl ? (
              <small className="form-error">URL harus wss:// atau https://</small>
            ) : null}
          </label>
          <label>
            LIVEKIT_API_URL (opsional, https://)
            <input
              value={form.livekitApiUrl || ""}
              onChange={(e) => setField("livekitApiUrl", e.target.value)}
              onBlur={() => normalizeLivekitFields()}
              placeholder="Kosongkan — otomatis dari LIVEKIT_URL"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            API Key {data?.livekitApiKeySet ? "(tersimpan — isi ulang untuk ganti)" : ""}
            <input
              value={form.livekitApiKey || ""}
              onChange={(e) => setField("livekitApiKey", e.target.value)}
              type="password"
              placeholder={
                data?.livekitApiKeySet
                  ? "•••••••• (tersimpan)"
                  : "API Key dari LiveKit Cloud"
              }
              autoComplete="new-password"
            />
          </label>
          <label>
            API Secret{" "}
            {data?.livekitApiSecretSet ? "(tersimpan — isi ulang untuk ganti)" : ""}
            <input
              value={form.livekitApiSecret || ""}
              onChange={(e) => setField("livekitApiSecret", e.target.value)}
              type="password"
              placeholder={
                data?.livekitApiSecretSet
                  ? "•••••••• (tersimpan)"
                  : "API Secret dari LiveKit Cloud"
              }
              autoComplete="new-password"
            />
          </label>
          <div className="admin-livekit-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={busy || !encryptionConfigured}
              onClick={() => void saveLivekitOnly()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              Simpan LiveKit
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy || testing || !encryptionConfigured}
              onClick={() => void testLivekit()}
            >
              {testing ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Wifi size={16} />
              )}
              Tes koneksi
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Aplikasi</legend>
          <label>
            APP_URL
            <input
              value={form.appUrl || ""}
              onChange={(e) => setField("appUrl", e.target.value)}
              placeholder="https://domainanda.com"
            />
          </label>
          <label>
            CRON_SECRET {data?.cronSecretSet ? "(tersimpan)" : ""}
            <input
              value={form.cronSecret || ""}
              onChange={(e) => setField("cronSecret", e.target.value)}
              placeholder="Kosongkan jika tidak diubah"
              type="password"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Email (Resend)</legend>
          <label>
            EMAIL_FROM
            <input
              value={form.emailFrom || ""}
              onChange={(e) => setField("emailFrom", e.target.value)}
            />
          </label>
          <label>
            RESEND_API_KEY {data?.resendApiKeySet ? "(tersimpan)" : ""}
            <input
              value={form.resendApiKey || ""}
              onChange={(e) => setField("resendApiKey", e.target.value)}
              type="password"
              placeholder="Kosongkan jika tidak diubah"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>WhatsApp (Fonnte)</legend>
          <label>
            FONNTE_TOKEN {data?.fonnteTokenSet ? "(tersimpan)" : ""}
            <input
              value={form.fonnteToken || ""}
              onChange={(e) => setField("fonnteToken", e.target.value)}
              type="password"
              placeholder="Kosongkan jika tidak diubah"
            />
          </label>
          <label>
            Country code
            <input
              value={form.fonnteCountryCode || "62"}
              onChange={(e) => setField("fonnteCountryCode", e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <label>
            Provider default
            <select
              value={form.paymentProvider || "MIDTRANS"}
              onChange={(e) => setField("paymentProvider", e.target.value)}
            >
              <option value="MIDTRANS">MIDTRANS</option>
              <option value="IPAYMU">IPAYMU</option>
              <option value="FLIP">FLIP</option>
            </select>
          </label>
          <label>
            Midtrans server key {data?.midtransServerKeySet ? "(tersimpan)" : ""}
            <input
              value={form.midtransServerKey || ""}
              onChange={(e) => setField("midtransServerKey", e.target.value)}
              type="password"
            />
          </label>
          <label>
            Midtrans client key {data?.midtransClientKeySet ? "(tersimpan)" : ""}
            <input
              value={form.midtransClientKey || ""}
              onChange={(e) => setField("midtransClientKey", e.target.value)}
              type="password"
            />
          </label>
          <label>
            Midtrans production
            <select
              value={form.midtransIsProduction || "false"}
              onChange={(e) => setField("midtransIsProduction", e.target.value)}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            iPaymu VA
            <input
              value={form.ipaymuVa || ""}
              onChange={(e) => setField("ipaymuVa", e.target.value)}
            />
          </label>
          <label>
            iPaymu API key {data?.ipaymuApiKeySet ? "(tersimpan)" : ""}
            <input
              value={form.ipaymuApiKey || ""}
              onChange={(e) => setField("ipaymuApiKey", e.target.value)}
              type="password"
            />
          </label>
          <label>
            Flip secret {data?.flipSecretKeySet ? "(tersimpan)" : ""}
            <input
              value={form.flipSecretKey || ""}
              onChange={(e) => setField("flipSecretKey", e.target.value)}
              type="password"
            />
          </label>
          <label>
            Flip validation token{" "}
            {data?.flipValidationTokenSet ? "(tersimpan)" : ""}
            <input
              value={form.flipValidationToken || ""}
              onChange={(e) => setField("flipValidationToken", e.target.value)}
              type="password"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Google OAuth</legend>
          <p className="admin-muted">
            Redirect URI:{" "}
            <code>
              {`${form.appUrl || "https://domainanda.com"}/api/auth/google/callback`}
            </code>
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
            GOOGLE_CLIENT_SECRET{" "}
            {data?.googleClientSecretSet ? "(tersimpan)" : ""}
            <input
              value={form.googleClientSecret || ""}
              onChange={(e) => setField("googleClientSecret", e.target.value)}
              type="password"
              placeholder="Kosongkan jika tidak diubah"
            />
          </label>
        </fieldset>

        <button
          className="button"
          type="submit"
          disabled={busy || !encryptionConfigured}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          Simpan semua integrasi
        </button>
      </form>
    </section>
  );
}
