import { describe, expect, it } from "vitest";
import {
  buildMeetingInviteEmail,
  buildMemberInviteEmail,
  parseInviteEmails,
} from "./email-templates";
import { summarizeDeliveries } from "./email";

describe("email templates", () => {
  it("builds a member invite with safe html and text", () => {
    const message = buildMemberInviteEmail({
      organizationName: "Acme <Corp>",
      inviterName: "Anisa",
      role: "MEMBER",
      inviteUrl: "https://app.example/invite/token",
      expiresAt: new Date("2026-08-01T10:00:00.000Z"),
    });

    expect(message.subject).toContain("Acme <Corp>");
    expect(message.html).toContain("Acme &lt;Corp&gt;");
    expect(message.html).toContain("https://app.example/invite/token");
    expect(message.text).toContain("https://app.example/invite/token");
  });

  it("builds a meeting invite with schedule details", () => {
    const message = buildMeetingInviteEmail({
      meetingTitle: "Weekly Sync",
      hostName: "Budi",
      organizationName: "GenMeet",
      meetingUrl: "https://app.example/meeting/focus-sync-abc",
      startsAt: new Date("2026-08-01T10:00:00.000Z"),
      waitingRoom: true,
      passwordRequired: true,
    });

    expect(message.subject).toContain("Weekly Sync");
    expect(message.text).toContain("Waiting room aktif");
    expect(message.text).toContain("Password diperlukan");
    expect(message.html).toContain("Gabung meeting");
  });

  it("parses and deduplicates invite emails", () => {
    expect(
      parseInviteEmails("a@example.com, B@example.com; a@example.com c@example.com"),
    ).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
  });
});

describe("email delivery summary", () => {
  it("summarizes mixed delivery results", () => {
    expect(summarizeDeliveries([])).toBe("manual_link");
    expect(
      summarizeDeliveries([
        { ok: true, delivery: "email" },
        { ok: true, delivery: "email" },
      ]),
    ).toBe("email");
    expect(
      summarizeDeliveries([
        { ok: false, delivery: "manual_link" },
        { ok: false, delivery: "manual_link" },
      ]),
    ).toBe("manual_link");
    expect(
      summarizeDeliveries([
        { ok: true, delivery: "email" },
        { ok: false, delivery: "email_failed" },
      ]),
    ).toBe("email");
    expect(
      summarizeDeliveries([{ ok: false, delivery: "email_failed" }]),
    ).toBe("email_failed");
  });
});
