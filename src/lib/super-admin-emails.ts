export function getConfiguredSuperAdminEmails(
  raw = process.env.SUPER_ADMIN_EMAIL?.trim() || "",
) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
