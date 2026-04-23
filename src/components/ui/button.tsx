import { forwardRef, type ButtonHTMLAttributes, type ReactElement, cloneElement, isValidElement } from "react";

const variantClasses = {
  primary:
    "bg-accent text-cream-50 hover:bg-accent-hover",
  secondary:
    "bg-transparent text-fg1 border border-border hover:bg-bg-tinted",
  ghost:
    "bg-transparent text-clay-600 hover:underline",
} as const;

const sizeClasses = {
  sm: "text-[13px] px-3.5 py-[7px]",
  md: "text-[14px] px-5 py-[11px]",
  lg: "text-[15px] px-[26px] py-[14px]",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses;
  size?: "sm" | "md" | "lg";
  /** Render as the child element (e.g. <Button asChild><Link>…</Link></Button>) */
  asChild?: boolean;
};

function buildClassName(
  variant: keyof typeof variantClasses,
  size: "sm" | "md" | "lg",
  disabled: boolean | undefined,
  className: string
): string {
  return [
    "inline-flex items-center justify-center font-semibold rounded-md tracking-[-0.005em] no-underline transition-all duration-[120ms] ease-[cubic-bezier(.2,.7,.2,1)] cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-clay-500 focus-visible:outline-offset-2",
    "active:scale-[0.98] active:transition-transform active:duration-[80ms]",
    variantClasses[variant],
    sizeClasses[size],
    disabled
      ? "!bg-bg-tinted !text-fg4 !border-transparent cursor-not-allowed active:!scale-100"
      : "",
    variant === "ghost" ? "px-3" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, asChild, children, ...props }, ref) => {
    const cn = buildClassName(variant, size, disabled, className);

    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, {
        className: cn,
        ref,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps };
