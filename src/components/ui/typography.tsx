import type { HTMLAttributes, ElementType } from "react";

type TypographyProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
};

function createTypo(
  defaultTag: ElementType,
  tvClass: string,
  displayName: string
) {
  function Component({ as, className = "", ...props }: TypographyProps) {
    const Tag = (as || defaultTag) as ElementType;
    return <Tag className={`${tvClass} ${className}`} {...props} />;
  }
  Component.displayName = displayName;
  return Component;
}

const Eyebrow = createTypo("span", "tv-eyebrow", "Eyebrow");
const H1 = createTypo("h1", "tv-h1", "H1");
const H2 = createTypo("h2", "tv-h2", "H2");
const H3 = createTypo("h3", "tv-h3", "H3");
const H4 = createTypo("h4", "tv-h4", "H4");
const Lede = createTypo("p", "tv-lede", "Lede");
const Body = createTypo("p", "tv-p", "Body");
const Small = createTypo("p", "tv-small", "Small");

export { Eyebrow, H1, H2, H3, H4, Lede, Body, Small };
