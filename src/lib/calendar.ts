export type CalendarView = "month" | "week";

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay(); // 0 Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(next, mondayOffset);
}

export function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function buildMonthGrid(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const days: Date[] = [];
  for (let index = 0; index < 42; index += 1) {
    days.push(addDays(gridStart, index));
  }
  return days;
}

export function buildWeekDays(anchor: Date) {
  const weekStart = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function shiftCalendarAnchor(anchor: Date, view: CalendarView, direction: -1 | 1) {
  const next = new Date(anchor);
  if (view === "month") {
    next.setMonth(next.getMonth() + direction);
    return startOfMonth(next);
  }
  return addDays(startOfWeek(next), direction * 7);
}

export function calendarRange(anchor: Date, view: CalendarView) {
  if (view === "week") {
    const weekStart = startOfWeek(anchor);
    return {
      from: weekStart,
      to: endOfDay(addDays(weekStart, 6)),
    };
  }

  const days = buildMonthGrid(anchor);
  return {
    from: startOfDay(days[0]),
    to: endOfDay(days[days.length - 1]),
  };
}

export function groupMeetingsByDay<T extends { startsAt: string | null; createdAt: string }>(
  meetings: T[],
) {
  const groups = new Map<string, T[]>();
  for (const meeting of meetings) {
    const date = new Date(meeting.startsAt ?? meeting.createdAt);
    const key = toDateKey(date);
    const list = groups.get(key) ?? [];
    list.push(meeting);
    groups.set(key, list);
  }
  return groups;
}
