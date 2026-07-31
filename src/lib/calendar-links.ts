function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildIcsMeeting(input: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  durationMinutes?: number;
  url?: string;
}) {
  const start = input.startsAt;
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GenMeet//Meeting//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];

  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  if (input.url) {
    lines.push(`URL:${escapeIcsText(input.url)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function googleCalendarUrl(input: {
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  durationMinutes?: number;
}) {
  const start = input.startsAt;
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${formatIcsUtc(start)}/${formatIcsUtc(end)}`,
  });

  if (input.description) {
    params.set("details", input.description);
  }
  if (input.location) {
    params.set("location", input.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
