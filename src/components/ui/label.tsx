import type { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

function Label({ required, className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={`block font-sans text-[13px] font-medium text-fg2 mb-1.5 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-clay-600 ml-0.5">*</span>}
    </label>
  );
}

export { Label };
export type { LabelProps };
