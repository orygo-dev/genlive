import { NextResponse } from "next/server";
import { getSuperAdminContext } from "@/lib/super-admin";

export async function requireSuperAdminApi() {
  const context = await getSuperAdminContext();
  if (!context) {
    return {
      context: null as null,
      error: NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 403 }),
    };
  }
  return { context, error: null as null };
}
