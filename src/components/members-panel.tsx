"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  LoaderCircle,
  MailPlus,
  Trash2,
  UserMinus,
} from "lucide-react";
import {
  auditActionLabel,
  invitationStatusLabel,
  roleLabel,
  type OrgRoleLabel,
} from "@/lib/organization-labels";

type MemberRow = {
  id: string;
  role: OrgRoleLabel;
  joinedAt: string;
  user: { id: string; name: string; email: string };
};

type InvitationRow = {
  id: string;
  email: string;
  role: OrgRoleLabel;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: { name: string; email: string };
};

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
  metadata: unknown;
};

export function MembersPanel({
  currentUserId,
  currentRole,
  canManage,
  members,
  invitations,
  auditLogs,
}: {
  currentUserId: string;
  currentRole: OrgRoleLabel;
  canManage: boolean;
  members: MemberRow[];
  invitations: InvitationRow[];
  auditLogs: AuditRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [delivery, setDelivery] = useState<
    "email" | "manual_link" | "email_failed" | ""
  >("");
  const [busyKey, setBusyKey] = useState("");

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInviteUrl("");
    setDelivery("");
    setBusyKey("invite");

    try {
      const response = await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = (await response.json()) as {
        error?: string;
        inviteUrl?: string;
        delivery?: "email" | "manual_link" | "email_failed";
      };

      if (!response.ok || !result.inviteUrl) {
        throw new Error(result.error ?? "Undangan belum dapat dikirim.");
      }

      setEmail("");
      setRole("MEMBER");
      setInviteUrl(`${window.location.origin}${result.inviteUrl}`);
      setDelivery(result.delivery ?? "manual_link");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Undangan belum dapat dikirim.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function updateRole(memberId: string, nextRole: OrgRoleLabel) {
    setError("");
    setBusyKey(`role:${memberId}`);

    try {
      const response = await fetch("/api/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: nextRole }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Peran belum dapat diubah.");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Peran belum dapat diubah.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("Hapus anggota ini dari workspace?")) {
      return;
    }

    setError("");
    setBusyKey(`remove:${memberId}`);

    try {
      const response = await fetch("/api/organizations/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Anggota belum dapat dihapus.");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Anggota belum dapat dihapus.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function revokeInvitation(invitationId: string) {
    setError("");
    setBusyKey(`revoke:${invitationId}`);

    try {
      const response = await fetch("/api/organizations/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Undangan belum dapat dibatalkan.");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Undangan belum dapat dibatalkan.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function copyInviteLink() {
    if (!inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      setError("Tautan undangan belum dapat disalin.");
    }
  }

  const pendingInvites = invitations.filter((item) => item.status === "PENDING");
  const roleOptions: OrgRoleLabel[] = ["OWNER", "ADMIN", "MEMBER"];

  return (
    <div className="members-panel">
      {canManage ? (
        <section className="members-invite">
          <div className="dashboard-section-heading">
            <div>
              <h2>Undang anggota</h2>
              <p>Email dikirim otomatis jika Resend sudah dikonfigurasi; tautan tetap bisa disalin.</p>
            </div>
          </div>
          <form onSubmit={inviteMember} className="members-invite-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@perusahaan.com"
                required
              />
            </label>
            <label>
              <span>Peran</span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "ADMIN" | "MEMBER")
                }
              >
                <option value="MEMBER">Member</option>
                {currentRole === "OWNER" ? (
                  <option value="ADMIN">Admin</option>
                ) : null}
              </select>
            </label>
            <button className="btn primary" type="submit" disabled={busyKey === "invite"}>
              {busyKey === "invite" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <MailPlus size={16} />
              )}
              Undang
            </button>
          </form>
          {inviteUrl ? (
            <div className="members-invite-link">
              <div>
                <p className={delivery === "email" ? "form-success" : "form-error"}>
                  {delivery === "email"
                    ? "Email undangan terkirim. Tautan cadangan:"
                    : delivery === "email_failed"
                      ? "Email gagal dikirim. Bagikan tautan ini secara manual:"
                      : "Email belum dikonfigurasi. Bagikan tautan ini secara manual:"}
                </p>
                <code>{inviteUrl}</code>
              </div>
              <button type="button" onClick={() => void copyInviteLink()}>
                <Copy size={15} /> Salin
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <section className="members-list-section">
        <div className="dashboard-section-heading">
          <div>
            <h2>Anggota workspace</h2>
            <p>{members.length} orang aktif di organisasi ini.</p>
          </div>
        </div>
        <div className="members-table">
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            const canRemove =
              canManage &&
              !isSelf &&
              (currentRole === "OWNER" || member.role === "MEMBER");
            const canChangeRole = currentRole === "OWNER" && canRemove;

            return (
              <article key={member.id}>
                <div>
                  <strong>{member.user.name}</strong>
                  <p>{member.user.email}</p>
                </div>
                <div className="members-table-meta">
                  {canChangeRole ? (
                    <select
                      value={member.role}
                      disabled={busyKey === `role:${member.id}`}
                      onChange={(event) =>
                        void updateRole(
                          member.id,
                          event.target.value as OrgRoleLabel,
                        )
                      }
                    >
                      {roleOptions.map((option) => (
                        <option key={option} value={option}>
                          {roleLabel(option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="role-chip">{roleLabel(member.role)}</span>
                  )}
                  <small>
                    Bergabung{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                    }).format(new Date(member.joinedAt))}
                  </small>
                </div>
                {canRemove ? (
                  <button
                    type="button"
                    className="members-danger"
                    disabled={busyKey === `remove:${member.id}`}
                    onClick={() => void removeMember(member.id)}
                    aria-label={`Hapus ${member.user.name}`}
                  >
                    {busyKey === `remove:${member.id}` ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <UserMinus size={16} />
                    )}
                  </button>
                ) : (
                  <span className="members-spacer" />
                )}
              </article>
            );
          })}
        </div>
      </section>

      {canManage ? (
        <section className="members-list-section">
          <div className="dashboard-section-heading">
            <div>
              <h2>Undangan tertunda</h2>
              <p>Tautan berlaku 7 hari sejak dikirim.</p>
            </div>
          </div>
          {pendingInvites.length === 0 ? (
            <div className="dashboard-empty members-empty">
              <h3>Tidak ada undangan aktif</h3>
              <p>Undang anggota baru untuk mulai berkolaborasi.</p>
            </div>
          ) : (
            <div className="members-table">
              {pendingInvites.map((invitation) => (
                <article key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <p>
                      {roleLabel(invitation.role)} · oleh{" "}
                      {invitation.invitedBy.name}
                    </p>
                  </div>
                  <div className="members-table-meta">
                    <span className="role-chip pending">
                      {invitationStatusLabel(invitation.status)}
                    </span>
                    <small>
                      Kedaluwarsa{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                      }).format(new Date(invitation.expiresAt))}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="members-danger"
                    disabled={busyKey === `revoke:${invitation.id}`}
                    onClick={() => void revokeInvitation(invitation.id)}
                    aria-label={`Batalkan undangan ${invitation.email}`}
                  >
                    {busyKey === `revoke:${invitation.id}` ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canManage ? (
        <section className="members-list-section">
          <div className="dashboard-section-heading">
            <div>
              <h2>Aktivitas terbaru</h2>
              <p>Log perubahan anggota dan undangan.</p>
            </div>
          </div>
          {auditLogs.length === 0 ? (
            <div className="dashboard-empty members-empty">
              <h3>Belum ada aktivitas</h3>
              <p>Perubahan peran dan undangan akan tercatat di sini.</p>
            </div>
          ) : (
            <div className="audit-list">
              {auditLogs.map((log) => (
                <article key={log.id}>
                  <strong>{auditActionLabel(log.action)}</strong>
                  <p>
                    {log.actor?.name ?? "Sistem"} ·{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(log.createdAt))}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
