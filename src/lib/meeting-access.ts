import type { SessionUser } from "@/lib/organization-helpers";
import type { OrgRoleLabel } from "@/lib/organization-labels";

export type MeetingStatusLabel =
  | "SCHEDULED"
  | "ACTIVE"
  | "ENDED"
  | "CANCELLED";

export type MeetingAccessRecord = {
  id: string;
  organizationId: string;
  createdById: string;
  status: MeetingStatusLabel;
};

export function canManageMeeting(
  user: SessionUser,
  meeting: Pick<MeetingAccessRecord, "organizationId" | "createdById">,
) {
  if (user.id === meeting.createdById) {
    return true;
  }

  const membership = user.memberships.find(
    (item) => item.organization.id === meeting.organizationId,
  );

  return membership?.role === "OWNER" || membership?.role === "ADMIN";
}

export function canViewMeeting(
  user: SessionUser,
  meeting: Pick<MeetingAccessRecord, "organizationId">,
) {
  return user.memberships.some(
    (item) => item.organization.id === meeting.organizationId,
  );
}

export function canEditMeetingFields(status: MeetingStatusLabel) {
  return status === "SCHEDULED" || status === "ACTIVE";
}

export function canCancelMeeting(status: MeetingStatusLabel) {
  return status === "SCHEDULED" || status === "ACTIVE";
}

export function canStartMeeting(status: MeetingStatusLabel) {
  return status === "SCHEDULED";
}

export function meetingStatusLabel(status: MeetingStatusLabel) {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "ENDED":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return "Terjadwal";
  }
}

export function isOrgManager(role: OrgRoleLabel) {
  return role === "OWNER" || role === "ADMIN";
}
