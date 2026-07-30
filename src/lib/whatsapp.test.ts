import { describe, expect, it } from "vitest";
import { normalizePhoneNumber, parseInvitePhones } from "./phone";
import { buildMeetingInviteWhatsApp, buildMeetingReminderWhatsApp } from "./whatsapp-templates";

describe("phone normalization", () => {
  it("converts Indonesian local numbers to country code 62", () => {
    expect(normalizePhoneNumber("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneNumber("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhoneNumber("6281234567890")).toBe("6281234567890");
  });

  it("parses comma-separated phones", () => {
    expect(parseInvitePhones("08111111111, 08222222222")).toEqual([
      "628111111111",
      "628222222222",
    ]);
  });
});

describe("whatsapp templates", () => {
  it("builds invite and reminder messages", () => {
    const base = {
      meetingTitle: "Sync produk",
      hostName: "Anisa",
      organizationName: "GenMeet",
      meetingUrl: "https://app.example.com/meeting/abc",
      startsAt: new Date("2026-07-27T10:00:00+07:00"),
      waitingRoom: true,
      passwordRequired: false,
    };

    expect(buildMeetingInviteWhatsApp(base)).toContain("Sync produk");
    expect(buildMeetingInviteWhatsApp(base)).toContain("Gabung:");
    expect(buildMeetingReminderWhatsApp({ ...base, kind: "T_MINUS_1H" })).toContain(
      "1 jam",
    );
  });
});
