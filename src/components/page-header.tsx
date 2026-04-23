import { Eyebrow, H1, Lede } from "@/components/ui/typography";

type PageHeaderProps = {
  eyebrow?: string;
  title: string | React.ReactNode;
  lede?: string | React.ReactNode;
  actions?: React.ReactNode;
  size?: "default" | "compact";
};

export default function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  size = "default",
}: PageHeaderProps) {
  const compact = size === "compact";
  const gap = compact ? "mb-stack" : "mb-section";

  const heading = compact ? (
    <h1 className="tv-h3">{title}</h1>
  ) : (
    <H1>{title}</H1>
  );

  const ledeEl =
    lede != null
      ? typeof lede === "string"
        ? <Lede>{lede}</Lede>
        : lede
      : null;

  if (!actions) {
    return (
      <div className={`tv-page-header ${gap}`}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {heading}
        {ledeEl}
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-5 flex-wrap ${gap}`}>
      <div className="tv-page-header flex-1 min-w-[280px]">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {heading}
        {ledeEl}
      </div>
      <div className="flex items-center gap-button-grp flex-shrink-0">
        {actions}
      </div>
    </div>
  );
}
