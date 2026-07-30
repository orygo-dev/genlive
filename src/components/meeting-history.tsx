"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  Play,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import {
  canCancelMeeting,
  canManageMeeting,
  canStartMeeting,
  meetingStatusLabel,
} from "@/lib/meeting-access";
import type { OrgRoleLabel } from "@/lib/organization-labels";

export type HistoryMeeting = {
  id: string;
  title: string;
  roomName: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  startsAt: string | null;
  createdAt: string;
  createdById: string;
  participantCount: number;
};

type StatusFilter = "ALL" | "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";

export function MeetingHistory({
  meetings,
  currentUserId,
  currentRole,
  organizationId,
  initialFilter = "ALL",
}: {
  meetings: HistoryMeeting[];
  currentUserId: string;
  currentRole: OrgRoleLabel;
  organizationId: string;
  initialFilter?: StatusFilter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenId(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filtered =
    filter === "ALL"
      ? meetings
      : meetings.filter((meeting) => meeting.status === filter);

  const membershipUser = {
    id: currentUserId,
    name: "",
    email: "",
    memberships: [
      {
        id: "active",
        role: currentRole,
        joinedAt: new Date(0),
        organization: { id: organizationId, name: "", slug: "" },
      },
    ],
  };

  async function copyInvite(roomName: string) {
    setError("");
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/meeting/${roomName}`,
      );
      setOpenId(null);
    } catch {
      setError("Tautan undangan belum dapat disalin.");
    }
  }

  async function startMeeting(meeting: HistoryMeeting) {
    setError("");
    setBusyId(meeting.id);

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}/start`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Meeting belum dapat dimulai.");
      }

      router.push(`/meeting/${meeting.roomName}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dimulai.",
      );
    } finally {
      setBusyId("");
      setOpenId(null);
    }
  }

  async function cancelMeeting(meeting: HistoryMeeting) {
    if (!window.confirm(`Batalkan meeting "${meeting.title}"?`)) {
      return;
    }

    setError("");
    setBusyId(meeting.id);

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}/cancel`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Meeting belum dapat dibatalkan.");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dibatalkan.",
      );
    } finally {
      setBusyId("");
      setOpenId(null);
    }
  }

  return (
    <div className="meeting-history-panel">
      <div className="meeting-filters" role="tablist" aria-label="Filter status">
        {(
          [
            ["ALL", "Semua"],
            ["SCHEDULED", "Terjadwal"],
            ["ACTIVE", "Aktif"],
            ["ENDED", "Selesai"],
            ["CANCELLED", "Dibatalkan"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? "active" : undefined}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {filtered.length === 0 ? (
        <div className="dashboard-empty">
          <span><Video size={27} /></span>
          <h3>Tidak ada meeting</h3>
          <p>
            {filter === "ALL"
              ? "Mulai meeting pertama dan undang tim Anda untuk bergabung."
              : "Tidak ada meeting dengan status ini."}
          </p>
        </div>
      ) : (
        <div className="meeting-history" ref={menuRef}>
          {filtered.map((meeting) => {
            const date = meeting.startsAt
              ? new Date(meeting.startsAt)
              : new Date(meeting.createdAt);
            const canManage = canManageMeeting(membershipUser, {
              organizationId,
              createdById: meeting.createdById,
            });

            return (
              <article key={meeting.id}>
                <span className="meeting-history-icon"><Video size={18} /></span>
                <div className="meeting-history-main">
                  <Link href={`/dashboard/meetings/${meeting.id}`}>
                    <strong>{meeting.title}</strong>
                  </Link>
                  <p>{meeting.roomName}</p>
                </div>
                <div className="meeting-history-meta">
                  <span>
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(date)}
                  </span>
                  <span>
                    <Users size={13} /> {meeting.participantCount} peserta
                  </span>
                </div>
                <span className={`meeting-status status-${meeting.status.toLowerCase()}`}>
                  {meetingStatusLabel(meeting.status)}
                </span>
                <div className="meeting-menu">
                  <button
                    type="button"
                    aria-label={`Opsi ${meeting.title}`}
                    aria-expanded={openId === meeting.id}
                    disabled={busyId === meeting.id}
                    onClick={() =>
                      setOpenId((current) =>
                        current === meeting.id ? null : meeting.id,
                      )
                    }
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {openId === meeting.id ? (
                    <div className="meeting-menu-dropdown" role="menu">
                      <Link
                        href={`/dashboard/meetings/${meeting.id}`}
                        role="menuitem"
                        onClick={() => setOpenId(null)}
                      >
                        <ExternalLink size={15} /> Detail
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void copyInvite(meeting.roomName)}
                      >
                        <Copy size={15} /> Salin tautan
                      </button>
                      {canManage && canStartMeeting(meeting.status) ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void startMeeting(meeting)}
                        >
                          <Play size={15} /> Mulai meeting
                        </button>
                      ) : null}
                      {meeting.status === "ACTIVE" ? (
                        <Link
                          href={`/meeting/${meeting.roomName}`}
                          role="menuitem"
                          onClick={() => setOpenId(null)}
                        >
                          <Play size={15} /> Masuk room
                        </Link>
                      ) : null}
                      {canManage && canCancelMeeting(meeting.status) ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => void cancelMeeting(meeting)}
                        >
                          <Trash2 size={15} /> Batalkan
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
