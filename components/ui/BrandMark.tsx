import { ChartNoAxesCombined } from "lucide-react";

type BrandMarkProps = {
  size?: "default" | "large";
};

export function BrandMark({ size = "default" }: BrandMarkProps) {
  return (
    <div className={`brand ${size === "large" ? "large" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <ChartNoAxesCombined size={size === "large" ? 22 : 19} strokeWidth={2.3} />
      </span>
      <span>NetWorth Tracker</span>
    </div>
  );
}
