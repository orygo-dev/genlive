export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { assertProductionEnv } = await import("@/lib/production-env");
    assertProductionEnv();
  }
}
