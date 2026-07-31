import { formatIdr } from "@/lib/plans";

type InvoiceOrder = {
  orderId: string;
  planCode: string;
  amountIdr: number;
  status: string;
  provider: string;
  paidAt: Date | null;
  createdAt: Date;
};

type InvoiceOrg = {
  name: string;
};

type InvoiceBuyer = {
  name: string;
  email: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateId(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function buildInvoiceHtml(input: {
  order: InvoiceOrder;
  org: InvoiceOrg;
  buyer: InvoiceBuyer;
  appName: string;
}) {
  const { order, org, buyer, appName } = input;
  const issuedAt = order.paidAt ?? order.createdAt;
  const statusLabel =
    order.status === "REFUNDED"
      ? "Direfund"
      : order.status === "PAID"
        ? "Lunas"
        : order.status;

  return `<style>
    .invoice-print-page { font-family: Segoe UI, Arial, sans-serif; color: #1f2937; padding: 32px; background: #f8fafc; min-height: 100vh; }
    .invoice-print-page .invoice { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
    .invoice-print-page h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.02em; }
    .invoice-print-page .meta { color: #667085; font-size: 13px; margin-bottom: 24px; }
    .invoice-print-page .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .invoice-print-page .grid strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #667085; margin-bottom: 4px; }
    .invoice-print-page table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-print-page th, .invoice-print-page td { text-align: left; padding: 12px 0; border-bottom: 1px solid #eef2f6; font-size: 14px; }
    .invoice-print-page th { color: #667085; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    .invoice-print-page .total { font-size: 18px; font-weight: 700; }
    .invoice-print-page .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #ecfdf3; color: #027a48; font-size: 12px; font-weight: 700; }
    .invoice-print-page .badge.refunded { background: #fef3f2; color: #b42318; }
    .invoice-print-page .foot { color: #667085; font-size: 12px; line-height: 1.5; }
    @media print { .invoice-print-page { background: #fff; padding: 0; } .invoice-print-page .invoice { border: 0; } }
  </style>
  <div class="invoice-print-page"><div class="invoice">
    <h1>Invoice</h1>
    <p class="meta">${escapeHtml(appName)} · ${escapeHtml(order.orderId)}</p>

    <div class="grid">
      <div>
        <strong>Ditagihkan kepada</strong>
        ${escapeHtml(buyer.name)}<br />
        ${escapeHtml(buyer.email)}
      </div>
      <div>
        <strong>Organisasi</strong>
        ${escapeHtml(org.name)}
      </div>
      <div>
        <strong>Tanggal</strong>
        ${escapeHtml(formatDateId(issuedAt))}
      </div>
      <div>
        <strong>Status</strong>
        <span class="badge${order.status === "REFUNDED" ? " refunded" : ""}">${escapeHtml(statusLabel)}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Deskripsi</th>
          <th>Provider</th>
          <th>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Langganan plan ${escapeHtml(order.planCode)}</td>
          <td>${escapeHtml(order.provider)}</td>
          <td class="total">${escapeHtml(formatIdr(order.amountIdr))}</td>
        </tr>
      </tbody>
    </table>

    <p class="foot">
      Dokumen ini diterbitkan secara elektronik oleh ${escapeHtml(appName)}.
      Simpan invoice ini untuk keperluan administrasi dan pembukuan internal Anda.
    </p>
  </div></div>`;
}
