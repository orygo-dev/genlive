import Link from "next/link";
import { Download, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { getPlatformBranding } from "@/lib/platform-settings";
import { getPlatformConfig } from "@/lib/platform-config";
import {
  recordingStatusLabel,
  resolveRecordingDownloadUrl,
} from "@/lib/recording-helpers";

export const dynamic = "force-dynamic";

export default async function DashboardRecordingsPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();
  const config = await getPlatformConfig();
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
              Hasil rekaman meeting organisasi ini. Unduh tersedia setelah status
              Selesai dan Public URL R2 dikonfigurasi.
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
              const downloadUrl = resolveRecordingDownloadUrl({
                downloadUrl: recording.downloadUrl,
                filepath: recording.filepath,
                publicBaseUrl: config.livekitEgressS3PublicBaseUrl,
              });
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
                    {recording.status === "COMPLETE" && !downloadUrl ? (
                      <p className="meeting-invite-hint">
                        File selesai diproses, tetapi Public URL R2 belum diatur.
                        Super Admin → Integrasi → Public base URL (contoh{" "}
                        <code>https://pub-xxxx.r2.dev</code>).
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
                    {downloadUrl ? (
                      <a
                        className="button button-primary"
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
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
