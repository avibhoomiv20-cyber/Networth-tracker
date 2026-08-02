import { BrandMark } from "@/components/ui/BrandMark";

export default function Loading() {
  return (
    <main className="loading-screen" aria-live="polite">
      <BrandMark size="large" />
      <div className="loading-line" />
      <p>Preparing your portfolio…</p>
    </main>
  );
}
