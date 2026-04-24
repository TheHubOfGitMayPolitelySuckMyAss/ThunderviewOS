import { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/typography";

type FormSectionProps = {
  eyebrow: string;
  divider?: boolean;
  children: ReactNode;
  className?: string;
};

export default function FormSection({
  eyebrow,
  divider = false,
  children,
  className,
}: FormSectionProps) {
  const classes = [
    "tv-form-section",
    divider && "tv-form-section--divider",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <Eyebrow>{eyebrow}</Eyebrow>
      {children}
    </section>
  );
}
