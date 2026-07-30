function formatDateId(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

type MeetingMessageInput = {
  meetingTitle: string;
  hostName: string;
  organizationName: string;
  meetingUrl: string;
  startsAt: Date | null;
  waitingRoom: boolean;
  passwordRequired: boolean;
};

function accessNotes(input: MeetingMessageInput) {
  return [
    input.waitingRoom ? "Waiting room aktif" : null,
    input.passwordRequired ? "Password diperlukan" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildMeetingInviteWhatsApp(input: MeetingMessageInput) {
  const schedule = input.startsAt
    ? formatDateId(input.startsAt)
    : "Segera dimulai";
  const notes = accessNotes(input);

  return [
    `Halo! ${input.hostName} mengundang Anda ke meeting GenMeet.`,
    "",
    `*${input.meetingTitle}*`,
    `Workspace: ${input.organizationName}`,
    `Waktu: ${schedule}`,
    notes ? `Akses: ${notes}` : null,
    "",
    `Gabung: ${input.meetingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMeetingReminderWhatsApp(
  input: MeetingMessageInput & { kind: "T_MINUS_24H" | "T_MINUS_1H" },
) {
  const when =
    input.kind === "T_MINUS_24H"
      ? "besok (sekitar 24 jam lagi)"
      : "sebentar lagi (sekitar 1 jam lagi)";
  const schedule = input.startsAt
    ? formatDateId(input.startsAt)
    : "Segera dimulai";

  return [
    `Pengingat meeting GenMeet ${when}.`,
    "",
    `*${input.meetingTitle}*`,
    `Workspace: ${input.organizationName}`,
    `Waktu: ${schedule}`,
    `Host: ${input.hostName}`,
    "",
    `Gabung: ${input.meetingUrl}`,
  ].join("\n");
}
