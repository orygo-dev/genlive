"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { formatIdr, type PlanDefinition } from "@/lib/plans";

type ProviderOption = {
  id: "MIDTRANS" | "IPAYMU" | "FLIP";
  label: string;
  configured: boolean;
};

type BillingOrder = {
  id: string;
  orderId: string;
  provider: string;
  planCode: string;
  amountIdr: number;
  status: string;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

type BillingPayload = {
  plan: PlanDefinition;
  planCode: string;
  planExpiresAt: string | null;
  usage: {
    memberCount: number;
    meetingCount: number;
    meetingMinutes: number;
    recordingMinutes: number;
  };
  providers: ProviderOption[];
  defaultProvider: string;
  canManageBilling: boolean;
  orders: BillingOrder[];
  catalog: PlanDefinition[];
};

export function BillingPanel() {
  const router = useRouter();
  const [data, setData] = useState<BillingPayload | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/billing", { cache: "no-store" });
          const payload = (await response.json()) as BillingPayload & {
            error?: string;
          };
          if (cancelled) return;
          if (!response.ok) {
            throw new Error(payload.error ?? "Billing belum dapat dimuat.");
          }
          setData(payload);
          setProvider(payload.defaultProvider);
        } catch (requestError) {
          if (!cancelled) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Billing belum dapat dimuat.",
            );
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  async function startCheckout() {
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: "PRO", provider }),
      });
      const payload = (await response.json()) as {
        error?: string;
        checkoutUrl?: string;
      };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Checkout belum dapat dibuat.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Checkout belum dapat dibuat.",
      );
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="meeting-invite-hint">Memuat billing...</p>;
  }

  if (!data) {
    return <p className="form-error">{error}</p>;
  }

  const configuredProviders = data.providers.filter((item) => item.configured);
  const daysLeft =
    data.planCode === "PRO" && data.planExpiresAt
      ? Math.ceil(
          (new Date(data.planExpiresAt).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000),
        )
      : null;
  const showRenewalBanner =
    data.planCode === "PRO" &&
    daysLeft !== null &&
    daysLeft >= 0 &&
    daysLeft <= 7;

  return (
    <div className="billing-panel">
      {showRenewalBanner ? (
        <section className="billing-renewal-banner" role="status">
          <div>
            <strong>Plan Pro segera berakhir</strong>
            <p>
              {daysLeft === 0
                ? "Plan Pro berakhir hari ini."
                : `Plan Pro berakhir dalam ${daysLeft} hari.`}{" "}
              Perpanjang sekarang agar fitur Pro tetap aktif.
            </p>
          </div>
          {data.canManageBilling ? (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void startCheckout()}
            >
              Perpanjang Pro
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="meeting-detail-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>Plan aktif: {data.plan.name}</h2>
            <p>
              {data.planExpiresAt
                ? `Berlaku hingga ${new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "long",
                  }).format(new Date(data.planExpiresAt))}`
                : "Workspace Anda menggunakan kuota plan gratis."}
            </p>
          </div>
        </div>

        <div className="billing-usage">
          <article>
            <strong>
              {data.usage.memberCount}/{data.plan.maxMembers}
            </strong>
            <p>Anggota</p>
          </article>
          <article>
            <strong>
              {data.usage.meetingCount}/{data.plan.maxMeetingsPerMonth}
            </strong>
            <p>Meeting bulan ini</p>
          </article>
          <article>
            <strong>
              {data.usage.meetingMinutes}/{data.plan.maxMeetingMinutesPerMonth}
            </strong>
            <p>Menit meeting</p>
          </article>
          <article>
            <strong>
              {data.usage.recordingMinutes}/
              {data.plan.maxRecordingMinutesPerMonth}
            </strong>
            <p>Menit recording</p>
          </article>
        </div>
      </section>

      <section className="billing-plans">
        {data.catalog.map((plan) => {
          const isCurrent = plan.code === data.planCode;
          return (
            <article key={plan.code} className={isCurrent ? "current" : undefined}>
              <header>
                <span><Sparkles size={16} /></span>
                <div>
                  <strong>{plan.name}</strong>
                  <p>
                    {plan.priceIdr > 0
                      ? `${formatIdr(plan.priceIdr)} / 30 hari`
                      : "Gratis selamanya"}
                  </p>
                </div>
              </header>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.code === "PRO" && data.canManageBilling ? (
                <div className="billing-checkout">
                  <label>
                    <span>Payment gateway</span>
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                    >
                      {data.providers.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={!item.configured}
                        >
                          {item.label}
                          {item.configured ? "" : " (belum dikonfigurasi)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={
                      busy ||
                      configuredProviders.length === 0 ||
                      !configuredProviders.some((item) => item.id === provider)
                    }
                    onClick={() => void startCheckout()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <CreditCard size={16} />
                    )}
                    {isCurrent ? "Perpanjang Pro" : "Upgrade ke Pro"}
                  </button>
                  {configuredProviders.length === 0 ? (
                    <p className="form-error">
                      Belum ada gateway yang dikonfigurasi. Isi kredensial
                      Midtrans, iPaymu, atau Flip di `.env.local`.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <section className="meeting-detail-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>Riwayat pembayaran</h2>
            <p>Checkout terbaru untuk workspace ini.</p>
          </div>
        </div>
        {data.orders.length === 0 ? (
          <p className="meeting-invite-hint">Belum ada transaksi.</p>
        ) : (
          <div className="recording-list">
            {data.orders.map((order) => (
              <article key={order.id}>
                <div>
                  <strong>
                    {order.planCode} · {order.provider} · {order.status}
                  </strong>
                  <p>
                    {order.orderId} · {formatIdr(order.amountIdr)} ·{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(order.createdAt))}
                  </p>
                </div>
                {order.status === "PENDING" && order.checkoutUrl ? (
                  <a className="button button-ghost" href={order.checkoutUrl}>
                    Lanjutkan bayar
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="button button-ghost"
        onClick={() => router.refresh()}
      >
        Muat ulang status
      </button>
    </div>
  );
}
