import Link from "next/link";
import { Download, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { getPlatformBranding } from "@/lib/platform-settings";
import {
  recordingAppDownloadPath,
  recordingStatusLabel,
} from "@/lib/recording-helpers";

export const dynamic = "force-dynamic";

export default async function DashboardRecordingsPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();
  const organizationId = context.activeMembership.organization.id;

  const recordings = await prisma.recording.findMany({
    where: { organizationId },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      filepath: true,
      downloadUrl: true,
      durationSeconds: true,
      startedAt: true,
      endedAt: true,
      errorMessage: true,
      meeting: { select: { id: true, title: true, roomName: true } },
      startedBy: { select: { name: true } },
    },
  });

  return (
    <DashboardShell
      user={{
        name: context.user.name,
        email: context.user.email,
        isSuperAdmin: context.user.isSuperAdmin,
        emailVerifiedAt: context.user.emailVerifiedAt,
      }}
      memberships={context.user.memberships}
      activeOrganizationId={organizationId}
      activeNav="recordings"
      branding={branding}
    >
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <h1>Recording</h1>
            <p>
              Hasil rekaman meeting organisasi ini. Unduh lewat GenMeet (aman,
              tidak memakai link r2.dev yang sering diblokir browser).
            </p>
          </div>
        </div>

        {recordings.length === 0 ? (
          <div className="dashboard-empty members-empty">
            <span>
              <Video size={24} />
            </span>
            <h3>Belum ada recording</h3>
            <p>
              Mulai rekaman dari ruang meeting (tombol Rekam). Setelah stop,
              hasil muncul di sini.
            </p>
          </div>
        ) : (
          <div className="recording-list">
            {recordings.map((recording) => {
              const canDownload =
                recording.status === "COMPLETE" && Boolean(recording.filepath);
              return (
                <article key={recording.id}>
                  <div>
                    <strong>{recording.meeting.title}</strong>
                    <p>
                      {recordingStatusLabel(recording.status)}
                      {" · "}
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(recording.startedAt))}
                      {recording.durationSeconds
                        ? ` · ${Math.max(1, Math.round(recording.durationSeconds / 60))} menit`
                        : ""}
                      {recording.startedBy
                        ? ` · ${recording.startedBy.name}`
                        : ""}
                    </p>
                    {recording.errorMessage ? (
                      <p className="form-error">{recording.errorMessage}</p>
                    ) : null}
                    {recording.status === "COMPLETE" && !recording.filepath ? (
                      <p className="meeting-invite-hint">
                        Status selesai tetapi path file belum tersimpan. Coba
                        rekam ulang atau cek LiveKit Egress / R2.
                      </p>
                    ) : null}
                  </div>
                  <div className="recording-list-actions">
                    <Link
                      className="button button-ghost"
                      href={`/dashboard/meetings/${recording.meeting.id}`}
                    >
                      Detail meeting
                    </Link>
                    {canDownload ? (
                      <a
                        className="button button-primary"
                        href={recordingAppDownloadPath(
                          recording.meeting.id,
                          recording.id,
                        )}
                      >
                        <Download size={15} /> Unduh
                      </a>
                    ) : (
                      <span
                        className={`role-chip status-${recording.status.toLowerCase()}`}
                      >
                        {recordingStatusLabel(recording.status)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
