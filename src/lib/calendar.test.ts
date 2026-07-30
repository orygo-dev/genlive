import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  buildWeekDays,
  calendarRange,
  groupMeetingsByDay,
  sameDay,
  shiftCalendarAnchor,
  startOfWeek,
  toDateKey,
} from "./calendar";

describe("calendar helpers", () => {
  it("builds a monday-based week", () => {
    const sunday = new Date(2026, 6, 26); // Jul 26 2026 is Sunday
    const week = buildWeekDays(sunday);
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(1);
    expect(week[6].getDay()).toBe(0);
  });

  it("builds a 6-week month grid", () => {
    const july = new Date(2026, 6, 1);
    const grid = buildMonthGrid(july);
    expect(grid).toHaveLength(42);
    expect(startOfWeek(july).getTime()).toBe(grid[0].getTime());
  });

  it("shifts month and week anchors", () => {
    const july = new Date(2026, 6, 15);
    const nextMonth = shiftCalendarAnchor(july, "month", 1);
    expect(nextMonth.getMonth()).toBe(7);
    const nextWeek = shiftCalendarAnchor(july, "week", 1);
    expect(sameDay(nextWeek, addDaysSafe(startOfWeek(july), 7))).toBe(true);
  });

  it("groups meetings by local day key", () => {
    const groups = groupMeetingsByDay([
      {
        startsAt: "2026-07-26T03:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        startsAt: null,
        createdAt: "2026-07-26T10:00:00.000Z",
      },
    ]);
    expect(groups.size).toBeGreaterThan(0);
    for (const [key, items] of groups) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(items.length).toBeGreaterThan(0);
    }
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("returns inclusive calendar ranges", () => {
    const range = calendarRange(new Date(2026, 6, 15), "week");
    expect(range.from.getDay()).toBe(1);
    expect(range.to.getDay()).toBe(0);
  });
});

function addDaysSafe(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
