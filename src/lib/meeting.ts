import { z } from "zod";

const roomPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const meetingRequestSchema = z.object({
  roomName: z
    .string()
    .trim()
    .min(3, "Kode meeting minimal 3 karakter.")
    .max(64, "Kode meeting maksimal 64 karakter.")
    .regex(roomPattern, "Kode meeting hanya boleh berisi huruf, angka, dan tanda hubung."),
  participantName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(50, "Nama maksimal 50 karakter."),
  password: z.string().max(72, "Password meeting terlalu panjang.").optional(),
});

export type MeetingRequest = z.infer<typeof meetingRequestSchema>;

export function normalizeRoomName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function createRoomName(): string {
  const words = ["focus", "sync", "team", "meet", "room", "talk"];
  const first = words[Math.floor(Math.random() * words.length)];
  const second = words[Math.floor(Math.random() * words.length)];
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);

  return `${first}-${second}-${suffix}`;
}
