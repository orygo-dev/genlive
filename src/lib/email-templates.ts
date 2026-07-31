import { roleLabel, type OrgRoleLabel } from "./organization-labels";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateId(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function buildMemberInviteEmail(input: {
  organizationName: string;
  inviterName: string;
  role: OrgRoleLabel;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const org = escapeHtml(input.organizationName);
  const inviter = escapeHtml(input.inviterName);
  const role = escapeHtml(roleLabel(input.role));
  const expires = escapeHtml(formatDateId(input.expiresAt));
  const url = escapeHtml(input.inviteUrl);

  const subject = `Undangan bergabung ke ${input.organizationName} di GenMeet`;
  const text = [
    `${input.inviterName} mengundang Anda bergabung ke workspace ${input.organizationName} sebagai ${roleLabel(input.role)}.`,
    "",
    `Terima undangan: ${input.inviteUrl}`,
    `Berlaku hingga: ${formatDateId(input.expiresAt)}`,
    "",
    "Jika Anda tidak mengharapkan undangan ini, abaikan email ini.",
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">GenMeet</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">Undangan workspace</h1>
      <p style="margin:0 0 16px"><strong>${inviter}</strong> mengundang Anda bergabung ke <strong>${org}</strong> sebagai <strong>${role}</strong>.</p>
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Terima undangan
        </a>
      </p>
      <p style="margin:0 0 8px;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
      <p style="margin:0;color:#667085;font-size:13px">Berlaku hingga ${expires}.</p>
    </div>
  `;

  return { subject, html, text };
}

export function buildMeetingInviteEmail(input: {
  meetingTitle: string;
  hostName: string;
  organizationName: string;
  meetingUrl: string;
  startsAt: Date | null;
  waitingRoom: boolean;
  passwordRequired: boolean;
}) {
  const title = escapeHtml(input.meetingTitle);
  const host = escapeHtml(input.hostName);
  const org = escapeHtml(input.organizationName);
  const url = escapeHtml(input.meetingUrl);
  const schedule = input.startsAt
    ? escapeHtml(formatDateId(input.startsAt))
    : "Segera dimulai";

  const accessNotes = [
    input.waitingRoom ? "Waiting room aktif" : null,
    input.passwordRequired ? "Password diperlukan" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const subject = `Undangan meeting: ${input.meetingTitle}`;
  const text = [
    `${input.hostName} mengundang Anda ke meeting "${input.meetingTitle}" (${input.organizationName}).`,
    `Waktu: ${input.startsAt ? formatDateId(input.startsAt) : "Segera dimulai"}`,
    accessNotes ? `Akses: ${accessNotes}` : null,
    "",
    `Gabung meeting: ${input.meetingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">GenMeet</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">${title}</h1>
      <p style="margin:0 0 12px"><strong>${host}</strong> mengundang Anda ke meeting workspace <strong>${org}</strong>.</p>
      <p style="margin:0 0 8px"><strong>Waktu:</strong> ${schedule}</p>
      ${accessNotes ? `<p style="margin:0 0 16px;color:#667085;font-size:13px">${escapeHtml(accessNotes)}</p>` : ""}
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Gabung meeting
        </a>
      </p>
      <p style="margin:0;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
    </div>
  `;

  return { subject, html, text };
}

export function buildEmailVerificationEmail(input: {
  appName: string;
  userName: string;
  verifyUrl: string;
}) {
  const name = escapeHtml(input.userName);
  const app = escapeHtml(input.appName);
  const url = escapeHtml(input.verifyUrl);

  const subject = `Verifikasi email Anda — ${input.appName}`;
  const text = [
    `Halo ${input.userName},`,
    "",
    `Terima kasih telah mendaftar di ${input.appName}. Verifikasi alamat email Anda:`,
    input.verifyUrl,
    "",
    "Tautan berlaku 24 jam. Jika Anda tidak mendaftar, abaikan email ini.",
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">${app}</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">Verifikasi email</h1>
      <p style="margin:0 0 16px">Halo <strong>${name}</strong>, terima kasih telah mendaftar. Klik tombol di bawah untuk memverifikasi alamat email Anda.</p>
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Verifikasi email
        </a>
      </p>
      <p style="margin:0 0 8px;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
      <p style="margin:0;color:#667085;font-size:13px">Tautan berlaku 24 jam.</p>
    </div>
  `;

  return { subject, html, text };
}

export function buildPasswordResetEmail(input: {
  appName: string;
  userName: string;
  resetUrl: string;
}) {
  const name = escapeHtml(input.userName);
  const app = escapeHtml(input.appName);
  const url = escapeHtml(input.resetUrl);

  const subject = `Reset password — ${input.appName}`;
  const text = [
    `Halo ${input.userName},`,
    "",
    `Kami menerima permintaan reset password untuk akun ${input.appName} Anda.`,
    `Atur password baru: ${input.resetUrl}`,
    "",
    "Tautan berlaku 1 jam. Jika Anda tidak meminta reset, abaikan email ini.",
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">${app}</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">Reset password</h1>
      <p style="margin:0 0 16px">Halo <strong>${name}</strong>, klik tombol di bawah untuk mengatur password baru.</p>
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Atur password baru
        </a>
      </p>
      <p style="margin:0 0 8px;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
      <p style="margin:0;color:#667085;font-size:13px">Tautan berlaku 1 jam.</p>
    </div>
  `;

  return { subject, html, text };
}

export function buildPaymentInvoiceEmail(input: {
  appName: string;
  userName: string;
  planCode: string;
  amountIdr: number;
  invoiceUrl: string;
}) {
  const name = escapeHtml(input.userName);
  const app = escapeHtml(input.appName);
  const url = escapeHtml(input.invoiceUrl);
  const amount = escapeHtml(
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(input.amountIdr),
  );

  const subject = `Pembayaran berhasil — ${input.appName} ${input.planCode}`;
  const text = [
    `Halo ${input.userName},`,
    "",
    `Pembayaran plan ${input.planCode} (${amount}) telah kami terima.`,
    `Lihat invoice: ${input.invoiceUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">${app}</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">Pembayaran berhasil</h1>
      <p style="margin:0 0 16px">Halo <strong>${name}</strong>, plan <strong>${escapeHtml(input.planCode)}</strong> (${amount}) sudah aktif.</p>
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Lihat invoice
        </a>
      </p>
      <p style="margin:0;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
    </div>
  `;

  return { subject, html, text };
}

export function buildPlanExpiryReminderEmail(input: {
  appName: string;
  orgName: string;
  daysLeft: number;
  renewUrl: string;
  expiresAt: Date;
  kind: "T_MINUS_7D" | "T_MINUS_3D" | "T_MINUS_1D" | "EXPIRED";
}) {
  const app = escapeHtml(input.appName);
  const org = escapeHtml(input.orgName);
  const url = escapeHtml(input.renewUrl);
  const expires = escapeHtml(formatDateId(input.expiresAt));

  const headline =
    input.kind === "EXPIRED"
      ? "Plan Pro workspace Anda telah berakhir"
      : `Plan Pro workspace Anda berakhir dalam ${input.daysLeft} hari`;

  const bodyText =
    input.kind === "EXPIRED"
      ? `Plan Pro untuk workspace ${input.orgName} telah berakhir. Perpanjang sekarang untuk tetap menggunakan fitur Pro.`
      : `Plan Pro untuk workspace ${input.orgName} akan berakhir pada ${formatDateId(input.expiresAt)}. Perpanjang sekarang agar layanan tidak terputus.`;

  const subject =
    input.kind === "EXPIRED"
      ? `Plan Pro ${input.orgName} telah berakhir — ${input.appName}`
      : `Plan Pro ${input.orgName} berakhir ${input.daysLeft} hari lagi — ${input.appName}`;

  const text = [
    bodyText,
    "",
    `Perpanjang: ${input.renewUrl}`,
    `Berlaku hingga: ${formatDateId(input.expiresAt)}`,
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 8px;color:#0b5cff;font-weight:700">${app}</p>
      <h1 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.03em">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 16px">${escapeHtml(bodyText)}</p>
      <p style="margin:0 0 8px"><strong>Berlaku hingga:</strong> ${expires}</p>
      <p style="margin:0 0 20px">
        <a href="${url}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
          Perpanjang Pro
        </a>
      </p>
      <p style="margin:0;color:#667085;font-size:13px">Atau buka tautan ini:<br /><a href="${url}">${url}</a></p>
    </div>
  `;

  return { subject, html, text };
}

export function parseInviteEmails(value: unknown, max = 20) {
  const raw =
    typeof value === "string"
      ? value.split(/[,;\s]+/)
      : Array.isArray(value)
        ? value
        : [];

  const emails = raw
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => item.length > 0);

  const unique = [...new Set(emails)];
  return unique.slice(0, max);
}
