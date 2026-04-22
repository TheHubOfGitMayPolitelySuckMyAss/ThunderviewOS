import type { HTMLAttributes } from "react";

type FieldHelpProps = HTMLAttributes<HTMLParagraphElement> & {
  error?: boolean;
};

function FieldHelp({ error, className = "", children, ...props }: FieldHelpProps) {
  return (
    <p
      className={`text-[12.5px] mt-1.5 ${error ? "text-ember-600" : "text-fg3"} ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export { FieldHelp };
export type { FieldHelpProps };
