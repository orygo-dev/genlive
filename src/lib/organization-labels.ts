export type OrgRoleLabel = "OWNER" | "ADMIN" | "MEMBER";

export function roleLabel(role: OrgRoleLabel) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    default:
      return "Member";
  }
}

export function invitationStatusLabel(
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
) {
  switch (status) {
    case "PENDING":
      return "Menunggu";
    case "ACCEPTED":
      return "Diterima";
    case "REVOKED":
      return "Dibatalkan";
    default:
      return "Kedaluwarsa";
  }
}

export function auditActionLabel(action: string) {
  switch (action) {
    case "invitation.created":
      return "Mengirim undangan";
    case "invitation.revoked":
      return "Membatalkan undangan";
    case "invitation.accepted":
      return "Menerima undangan";
    case "member.role_updated":
      return "Mengubah peran anggota";
    case "member.removed":
      return "Menghapus anggota";
    case "member.left":
      return "Keluar dari workspace";
    case "organization.updated":
      return "Memperbarui workspace";
    case "organization.created":
      return "Membuat workspace";
    case "organization.deleted":
      return "Menghapus workspace";
    case "meeting.created":
      return "Membuat meeting";
    case "meeting.updated":
      return "Memperbarui meeting";
    case "meeting.cancelled":
      return "Membatalkan meeting";
    case "meeting.started":
      return "Memulai meeting";
    case "meeting.invited":
      return "Mengirim undangan meeting";
    case "recording.started":
      return "Memulai recording";
    case "recording.stopped":
      return "Menghentikan recording";
    case "billing.checkout_created":
      return "Membuat checkout billing";
    case "billing.payment_paid":
      return "Pembayaran berhasil";
    case "billing.plan_activated":
      return "Mengaktifkan plan";
    default:
      return action;
  }
}
