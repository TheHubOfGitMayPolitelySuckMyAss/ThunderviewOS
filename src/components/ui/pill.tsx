import type { HTMLAttributes } from "react";

type PillVariant = "stage" | "neutral" | "accent" | "success" | "warn" | "danger";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: PillVariant;
  /** Show a colored dot before the label (status pills) */
  dot?: boolean;
};

const variantStyles: Record<PillVariant, { pill: string; dot: string }> = {
  stage:   { pill: "bg-bg-elevated text-ink-700 border border-border", dot: "" },
  neutral: { pill: "bg-bg-tinted text-ink-900", dot: "" },
  accent:  { pill: "bg-tan-300 text-ink-900", dot: "" },
  success: { pill: "bg-[#E4E9D4] text-moss-600", dot: "bg-moss-600" },
  warn:    { pill: "bg-[#F3E3BE] text-[#8a6a1f]", dot: "bg-mustard-500" },
  danger:  { pill: "bg-[#F2D4CB] text-ember-600", dot: "bg-ember-600" },
};

function Pill({ variant = "stage", dot, className = "", children, ...props }: PillProps) {
  const s = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[12.5px] font-medium ${s.pill} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {children}
    </span>
  );
}

export { Pill };
export type { PillProps, PillVariant };
