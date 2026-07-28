// Recovery is intentionally the safe default. Set
// NEXT_PUBLIC_SYNC_RECOVERY_MODE=false only after the Mac backup, local audit,
// atomic cloud replacement, and two-way sync acceptance tests have passed.
export const syncRecoveryMode =
  process.env.NEXT_PUBLIC_SYNC_RECOVERY_MODE !== "false";
