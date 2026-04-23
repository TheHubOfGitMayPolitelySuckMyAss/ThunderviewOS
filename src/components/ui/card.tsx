import type { HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "elevated" | "feature" | "photo";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  /** For photo variant: URL of the image */
  photoSrc?: string;
  /** For photo variant: alt text */
  photoAlt?: string;
  /** For photo variant: optional object-position override */
  photoPosition?: string;
};

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-bg-elevated border border-border rounded-lg shadow-sm",
  elevated:
    "bg-bg-elevated border border-border rounded-lg shadow-md",
  feature:
    "bg-bg-elevated border border-transparent rounded-lg shadow-glow",
  photo:
    "bg-bg-elevated border border-border rounded-lg shadow-sm overflow-hidden",
};

function Card({
  variant = "default",
  photoSrc,
  photoAlt = "",
  photoPosition = "center",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`${variantStyles[variant]} transition-shadow duration-[120ms] hover:shadow-md ${className}`}
      {...props}
    >
      {variant === "photo" && photoSrc && (
        <div
          className="h-[140px] bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${photoSrc})`, backgroundPosition: photoPosition }}
          role="img"
          aria-label={photoAlt}
        />
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export { Card };
export type { CardProps };
