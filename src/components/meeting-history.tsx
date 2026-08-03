"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

type MenuPosition = {
  left: number;
  openUp: boolean;
  /** `top` when opening down; `bottom` inset when opening up */
  inset: number;
};

const MENU_WIDTH = 200;
const MENU_EST_HEIGHT = 220;
const MENU_GAP = 6;
const MENU_EDGE = 8;

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
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setOpenId(null);
    setMenuPos(null);
  }, []);

  const updateMenuPosition = useCallback((meetingId: string) => {
    const trigger = triggerRefs.current.get(meetingId);
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_EDGE;
    const spaceAbove = rect.top - MENU_EDGE;
    const openUp =
      spaceBelow < MENU_EST_HEIGHT && spaceAbove > spaceBelow;

    let left = rect.right - MENU_WIDTH;
    left = Math.max(
      MENU_EDGE,
      Math.min(left, window.innerWidth - MENU_WIDTH - MENU_EDGE),
    );

    if (openUp) {
      setMenuPos({
        left,
        openUp: true,
        inset: Math.max(MENU_EDGE, window.innerHeight - rect.top + MENU_GAP),
      });
    } else {
      setMenuPos({
        left,
        openUp: false,
        inset: rect.bottom + MENU_GAP,
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!openId) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition(openId);
  }, [openId, updateMenuPosition]);

  useEffect(() => {
    if (!openId) return;
    const activeId = openId;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const trigger = triggerRefs.current.get(activeId);
      if (trigger?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeMenu();
    }

    function onReposition() {
      updateMenuPosition(activeId);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [openId, closeMenu, updateMenuPosition]);

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
      closeMenu();
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
      closeMenu();
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
      closeMenu();
    }
  }

  const openMeeting = openId
    ? filtered.find((meeting) => meeting.id === openId) ?? null
    : null;

  const openCanManage = openMeeting
    ? canManageMeeting(membershipUser, {
        organizationId,
        createdById: openMeeting.createdById,
      })
    : false;

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
        <div className="meeting-history">
          {filtered.map((meeting) => {
            const date = meeting.startsAt
              ? new Date(meeting.startsAt)
              : new Date(meeting.createdAt);

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
                    ref={(node) => {
                      if (node) {
                        triggerRefs.current.set(meeting.id, node);
                      } else {
                        triggerRefs.current.delete(meeting.id);
                      }
                    }}
                    aria-label={`Opsi ${meeting.title}`}
                    aria-expanded={openId === meeting.id}
                    aria-haspopup="menu"
                    disabled={busyId === meeting.id}
                    onClick={() =>
                      setOpenId((current) =>
                        current === meeting.id ? null : meeting.id,
                      )
                    }
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {openMeeting && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              className="meeting-menu-dropdown"
              role="menu"
              style={{
                top: menuPos.openUp ? undefined : menuPos.inset,
                bottom: menuPos.openUp ? menuPos.inset : undefined,
                left: menuPos.left,
                width: MENU_WIDTH,
              }}
            >
              <Link
                href={`/dashboard/meetings/${openMeeting.id}`}
                role="menuitem"
                onClick={closeMenu}
              >
                <ExternalLink size={15} /> Detail
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void copyInvite(openMeeting.roomName)}
              >
                <Copy size={15} /> Salin tautan
              </button>
              {openCanManage && canStartMeeting(openMeeting.status) ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void startMeeting(openMeeting)}
                >
                  <Play size={15} /> Mulai meeting
                </button>
              ) : null}
              {openMeeting.status === "ACTIVE" ? (
                <Link
                  href={`/meeting/${openMeeting.roomName}`}
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <Play size={15} /> Masuk room
                </Link>
              ) : null}
              {openCanManage && canCancelMeeting(openMeeting.status) ? (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => void cancelMeeting(openMeeting)}
                >
                  <Trash2 size={15} /> Batalkan
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
