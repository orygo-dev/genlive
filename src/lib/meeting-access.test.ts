import { describe, expect, it } from "vitest";
import {
  canCancelMeeting,
  canEditMeetingFields,
  canManageMeeting,
  canStartMeeting,
  canViewMeeting,
  meetingStatusLabel,
} from "./meeting-access";

const user = {
  id: "user-1",
  name: "Host",
  email: "host@example.com",
  memberships: [
    {
      id: "m1",
      role: "MEMBER" as const,
      joinedAt: new Date("2026-01-01"),
      organization: { id: "org-1", name: "Alpha", slug: "alpha" },
    },
  ],
};

const admin = {
  ...user,
  id: "admin-1",
  memberships: [
    {
      ...user.memberships[0],
      role: "ADMIN" as const,
    },
  ],
};

describe("meeting access helpers", () => {
  it("lets creators and org managers manage meetings", () => {
    const meeting = {
      organizationId: "org-1",
      createdById: "user-1",
    };

    expect(canManageMeeting(user, meeting)).toBe(true);
    expect(canManageMeeting(admin, { ...meeting, createdById: "other" })).toBe(
      true,
    );
    expect(
      canManageMeeting(user, { organizationId: "org-2", createdById: "other" }),
    ).toBe(false);
  });

  it("allows org members to view meetings", () => {
    expect(canViewMeeting(user, { organizationId: "org-1" })).toBe(true);
    expect(canViewMeeting(user, { organizationId: "org-2" })).toBe(false);
  });

  it("gates edit/cancel/start by status", () => {
    expect(canEditMeetingFields("SCHEDULED")).toBe(true);
    expect(canEditMeetingFields("ACTIVE")).toBe(true);
    expect(canEditMeetingFields("ENDED")).toBe(false);
    expect(canCancelMeeting("ACTIVE")).toBe(true);
    expect(canCancelMeeting("ENDED")).toBe(false);
    expect(canStartMeeting("SCHEDULED")).toBe(true);
    expect(canStartMeeting("ACTIVE")).toBe(false);
  });

  it("labels meeting status for UI", () => {
    expect(meetingStatusLabel("SCHEDULED")).toBe("Terjadwal");
    expect(meetingStatusLabel("ACTIVE")).toBe("Aktif");
    expect(meetingStatusLabel("ENDED")).toBe("Selesai");
    expect(meetingStatusLabel("CANCELLED")).toBe("Dibatalkan");
  });
});
