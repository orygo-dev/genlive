"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, PlugZap, Save, Trash2, Wifi } from "lucide-react";
import {
  isValidLivekitUrl,
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
} from "@/lib/livekit-url";

type IntegrationsView = Record<
  string,
  string | boolean | string[] | LiveKitServerView[] | null | undefined
>;

type LiveKitServerView = {
  id: string;
  name: string;
  kind: "CLOUD" | "SELF_HOSTED";
  url: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  apiKeySet: boolean;
  apiSecretSet: boolean;
};

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
  const [testingServerId, setTestingServerId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [livekitServers, setLivekitServers] = useState<LiveKitServerView[]>([]);
  const [activeLivekitServerId, setActiveLivekitServerId] = useState("");
  const testing = Boolean(testingServerId);
  const activeLivekitServer = livekitServers.find(
    (server) => server.id === activeLivekitServerId,
  );
  const livekitStatus = useMemo(() => {
    const urlOk = isValidLivekitUrl(form.livekitUrl);
    const keyOk = Boolean(form.livekitApiKey?.trim() || activeLivekitServer?.apiKeySet);
    const secretOk = Boolean(
      form.livekitApiSecret?.trim() || activeLivekitServer?.apiSecretSet,
    );
    return { urlOk, keyOk, secretOk, ready: urlOk && keyOk && secretOk };
  }, [form.livekitUrl, form.livekitApiKey, form.livekitApiSecret, activeLivekitServer]);

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
      const servers = Array.isArray(payload.integrations.livekitServers)
        ? (payload.integrations.livekitServers as LiveKitServerView[]).map((server) => ({
            ...server,
            apiKey: "",
            apiSecret: "",
          }))
        : [];
      setLivekitServers(servers);
      setActiveLivekitServerId(
        String(payload.integrations.activeLivekitServerId || servers[0]?.id || ""),
      );
      setForm({
        appUrl: String(payload.integrations.appUrl || ""),
        livekitUrl: servers.find((server) => server.id === String(payload.integrations!.activeLivekitServerId || servers[0]?.id))?.url || "",
        livekitApiUrl: servers.find((server) => server.id === String(payload.integrations!.activeLivekitServerId || servers[0]?.id))?.apiUrl || "",
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
    // Initial data hydration from the admin API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    const livekitKey = {
      livekitUrl: "url",
      livekitApiUrl: "apiUrl",
      livekitApiKey: "apiKey",
      livekitApiSecret: "apiSecret",
    }[key] as keyof LiveKitServerView | undefined;
    if (livekitKey && activeLivekitServerId) {
      updateLivekitServer(activeLivekitServerId, { [livekitKey]: value });
    }
  }

  function selectLivekitServer(id: string) {
    const server = livekitServers.find((item) => item.id === id);
    if (!server) return;
    setActiveLivekitServerId(id);
    setForm((current) => ({
      ...current,
      livekitUrl: server.url,
      livekitApiUrl: server.apiUrl,
      livekitApiKey: server.apiKey,
      livekitApiSecret: server.apiSecret,
    }));
  }

  function normalizeLivekitFields() {
    const url = normalizeLivekitUrl(form.livekitUrl) || "";
    const kind = activeLivekitServer?.kind || "CLOUD";
    const apiUrl =
      normalizeLivekitApiUrl(form.livekitApiUrl, url, { kind }) || "";
    setForm((prev) => ({ ...prev, livekitUrl: url, livekitApiUrl: apiUrl }));
    if (activeLivekitServerId) {
      updateLivekitServer(activeLivekitServerId, { url, apiUrl, kind });
    }
    return { url, apiUrl };
  }

  function updateLivekitServer(id: string, patch: Partial<LiveKitServerView>) {
    setLivekitServers((current) =>
      current.map((server) => (server.id === id ? { ...server, ...patch } : server)),
    );
  }

  function addLivekitServer() {
    const id = `livekit-${Date.now().toString(36)}`;
    setLivekitServers((current) => [
      ...current,
      {
        id,
        name: `Server ${current.length + 1}`,
        kind: "CLOUD",
        url: "",
        apiUrl: "",
        apiKey: "",
        apiSecret: "",
        apiKeySet: false,
        apiSecretSet: false,
      },
    ]);
    setActiveLivekitServerId(id);
    setForm((current) => ({
      ...current,
      livekitUrl: "",
      livekitApiUrl: "",
      livekitApiKey: "",
      livekitApiSecret: "",
    }));
  }

  function removeLivekitServer(id: string) {
    setLivekitServers((current) => {
      const next = current.filter((server) => server.id !== id);
      if (activeLivekitServerId === id) {
        const replacement = next[0];
        setActiveLivekitServerId(replacement?.id || "");
        setForm((formValue) => ({
          ...formValue,
          livekitUrl: replacement?.url || "",
          livekitApiUrl: replacement?.apiUrl || "",
          livekitApiKey: replacement?.apiKey || "",
          livekitApiSecret: replacement?.apiSecret || "",
        }));
      }
      return next;
    });
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
      const body: Record<string, unknown> = {
        appUrl: form.appUrl || null,
        emailFrom: form.emailFrom || null,
        fonnteCountryCode: form.fonnteCountryCode || "62",
        paymentProvider: form.paymentProvider || null,
        midtransIsProduction: form.midtransIsProduction === "true",
        ipaymuVa: form.ipaymuVa || null,
        ipaymuIsProduction: form.ipaymuIsProduction === "true",
        flipIsProduction: form.flipIsProduction === "true",
      };
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
      if (livekitServers.length === 0) {
        throw new Error("Tambahkan minimal satu server LiveKit.");
      }
      const normalized = livekitServers.map((server) => {
        const url = normalizeLivekitUrl(server.url) || "";
        const apiUrl =
          normalizeLivekitApiUrl(server.apiUrl, url, { kind: server.kind }) ||
          "";
        if (!server.name.trim()) throw new Error("Nama server LiveKit wajib diisi.");
        if (!isValidLivekitUrl(url)) {
          throw new Error(`URL server “${server.name}” tidak valid.`);
        }
        if (!server.apiKey.trim() && !server.apiKeySet) {
          throw new Error(`API Key server “${server.name}” wajib diisi.`);
        }
        if (!server.apiSecret.trim() && !server.apiSecretSet) {
          throw new Error(`API Secret server “${server.name}” wajib diisi.`);
        }
        return { ...server, url, apiUrl };
      });

      await saveIntegrations({
        livekitServers: normalized.map((server) => ({
          id: server.id,
          name: server.name,
          kind: server.kind,
          url: server.url,
          // Cloud: omit custom apiUrl — server derives from url.
          apiUrl: server.kind === "CLOUD" ? null : server.apiUrl || null,
          apiKey: server.apiKey,
          apiSecret: server.apiSecret,
        })),
        activeLivekitServerId,
      });
      setMessage("Profil LiveKit tersimpan dan server aktif telah diterapkan.");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Gagal menyimpan LiveKit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testLivekit(serverId: string) {
    setTestingServerId(serverId);
    setError("");
    setMessage("");
    try {
      const server = livekitServers.find((item) => item.id === serverId);
      const url = normalizeLivekitUrl(server?.url || form.livekitUrl) || "";
      const kind = server?.kind || "CLOUD";
      const apiUrl =
        normalizeLivekitApiUrl(server?.apiUrl || form.livekitApiUrl, url, {
          kind,
        }) || "";
      if (!isValidLivekitUrl(url)) {
        throw new Error("LIVEKIT_URL belum valid (wss:// atau ws://).");
      }
      const draftKey = (server?.apiKey || form.livekitApiKey || "").trim();
      const draftSecret = (
        server?.apiSecret ||
        form.livekitApiSecret ||
        ""
      ).trim();
      if (!draftKey || !draftSecret) {
        throw new Error(
          "Tempel ulang API Key dan API Secret di form sebelum Tes (jangan mengandalkan “(tersimpan)” saja). Jangan kirim Secret ke chat dukungan.",
        );
      }
      const response = await fetch("/api/admin/integrations/test-livekit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          url,
          apiUrl: kind === "CLOUD" ? undefined : apiUrl || undefined,
          apiKey: draftKey,
          apiSecret: draftSecret,
          kind,
        }),
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
      if (serverId === activeLivekitServerId) setLivekitReady(true);
      setMessage(payload.message || "LiveKit OK.");
    } catch (testError) {
      if (serverId === activeLivekitServerId) setLivekitReady(false);
      setError(testError instanceof Error ? testError.message : "Tes gagal.");
    } finally {
      setTestingServerId("");
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h2>Integrasi platform</h2>
          <p className="admin-muted">
            LiveKit, email, WhatsApp, payment - tersimpan terenkripsi di database.
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
          <legend>Server LiveKit (multi-server)</legend>
          <div className="admin-livekit-status">
            {livekitReady || livekitStatus.ready ? (
              <span className="admin-livekit-badge is-ok">
                <CheckCircle2 size={14} /> Konfigurasi aktif lengkap
              </span>
            ) : (
              <span className="admin-livekit-badge is-warn">
                <Wifi size={14} /> Konfigurasi belum lengkap
              </span>
            )}
            {data?.livekitStoredInDatabase ? (
              <span className="admin-muted">Tersimpan di database</span>
            ) : (
              <span className="admin-muted">Belum tersimpan di database</span>
            )}
          </div>
          <p className="admin-muted">
            Isi WebSocket URL (wss://...), API Key, dan API Secret dari server
            yang sama (Cloud atau self-hosted). URL https:// otomatis jadi
            wss://. Klik Tes koneksi, lalu Simpan & terapkan.
          </p>
          <div className="admin-livekit-profile-picker">
            <label>
              Profil aktif
              <select
                value={activeLivekitServerId}
                onChange={(event) => selectLivekitServer(event.target.value)}
              >
                {livekitServers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.kind === "CLOUD" ? "Cloud" : "Self-hosted"})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nama profil
              <input
                value={activeLivekitServer?.name || ""}
                onChange={(event) =>
                  activeLivekitServerId &&
                  updateLivekitServer(activeLivekitServerId, { name: event.target.value })
                }
                placeholder="LiveKit utama"
              />
            </label>
            <label>
              Jenis server
              <select
                value={activeLivekitServer?.kind || "CLOUD"}
                onChange={(event) =>
                  activeLivekitServerId &&
                  updateLivekitServer(activeLivekitServerId, {
                    kind: event.target.value as LiveKitServerView["kind"],
                  })
                }
              >
                <option value="CLOUD">LiveKit Cloud</option>
                <option value="SELF_HOSTED">Self-hosted</option>
              </select>
            </label>
          </div>
          <label>
            LIVEKIT_URL (wss://)
            <input
              value={form.livekitUrl || ""}
              onChange={(e) => setField("livekitUrl", e.target.value)}
              onBlur={() => normalizeLivekitFields()}
              placeholder={
                activeLivekitServer?.kind === "SELF_HOSTED"
                  ? "wss://meet.domainanda.com"
                  : "wss://your-project.livekit.cloud"
              }
              autoComplete="off"
              spellCheck={false}
            />
            {!livekitStatus.urlOk && form.livekitUrl ? (
              <small className="form-error">
                URL harus diawali wss://, ws://, https://, atau http://
              </small>
            ) : null}
            <small>
              Cloud: salin WebSocket URL dari project LiveKit Cloud (wss://…livekit.cloud).
              Key + Secret harus dari project yang sama.
            </small>
          </label>
          {activeLivekitServer?.kind === "SELF_HOSTED" ? (
            <label>
              LIVEKIT_API_URL (opsional, https://)
              <input
                value={form.livekitApiUrl || ""}
                onChange={(e) => setField("livekitApiUrl", e.target.value)}
                onBlur={() => normalizeLivekitFields()}
                placeholder="Kosongkan jika sama dengan host LIVEKIT_URL"
                autoComplete="off"
                spellCheck={false}
              />
              <small>
                Hanya untuk self-hosted jika API HTTP beda host/port. Cloud tidak
                membutuhkan field ini.
              </small>
            </label>
          ) : (
            <label>
              Host API (otomatis dari LIVEKIT_URL)
              <input
                value={
                  normalizeLivekitApiUrl("", form.livekitUrl, { kind: "CLOUD" }) ||
                  ""
                }
                readOnly
                disabled
              />
              <small>
                LiveKit Cloud memakai host yang sama dengan URL WebSocket (https://…).
                Tidak ada API URL terpisah.
              </small>
            </label>
          )}
          <label>
            API Key{" "}
            {activeLivekitServer?.apiKeySet
              ? "(tersimpan - isi ulang untuk ganti)"
              : ""}
            <input
              value={form.livekitApiKey || ""}
              onChange={(e) => setField("livekitApiKey", e.target.value)}
              type="password"
              placeholder={
                activeLivekitServer?.apiKeySet
                  ? "(tersimpan)"
                  : "API Key server LiveKit"
              }
              autoComplete="new-password"
            />
          </label>
          <label>
            API Secret{" "}
            {activeLivekitServer?.apiSecretSet
              ? "(tersimpan - isi ulang untuk ganti)"
              : ""}
            <input
              value={form.livekitApiSecret || ""}
              onChange={(e) => setField("livekitApiSecret", e.target.value)}
              type="password"
              placeholder={
                activeLivekitServer?.apiSecretSet
                  ? "(tersimpan)"
                  : "API Secret server LiveKit"
              }
              autoComplete="new-password"
            />
          </label>
          <div className="admin-livekit-actions">
            <button
              type="button"
              className="button button-ghost"
              disabled={busy || livekitServers.length >= 10}
              onClick={addLivekitServer}
            >
              <Plus size={16} /> Tambah server
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy || livekitServers.length <= 1 || !activeLivekitServerId}
              onClick={() => activeLivekitServerId && removeLivekitServer(activeLivekitServerId)}
            >
              <Trash2 size={16} /> Hapus profil
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={busy || !encryptionConfigured}
              onClick={() => void saveLivekitOnly()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              Simpan & terapkan
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy || testing || !encryptionConfigured || !activeLivekitServerId}
              onClick={() => void testLivekit(activeLivekitServerId)}
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
