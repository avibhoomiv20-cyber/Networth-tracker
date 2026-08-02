"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep monitoring privacy-safe: do not log financial payloads or records.
    console.error("AssetTracker page error", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="configuration-screen">
      <section className="configuration-card calm-error-card">
        <CircleAlert aria-hidden="true" size={26} />
        <p className="eyebrow">Unable to open your portfolio</p>
        <h1>Your confirmed information has not been changed.</h1>
        <p>Please retry. If the problem continues, verify your cloud connection.</p>
        <button className="primary-button" onClick={reset} type="button">
          Retry
        </button>
      </section>
    </main>
  );
}
