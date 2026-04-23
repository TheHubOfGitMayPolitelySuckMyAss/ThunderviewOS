import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = "", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={[
          "w-full font-sans text-[15px] text-fg1 bg-cream-50 border rounded-md px-3.5 py-[11px] outline-none transition-[border-color,box-shadow] duration-[120ms] appearance-none",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2375695B%22 stroke-width=%222%22><polyline points=%226 9 12 14 18 9%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat",
          error
            ? "border-ember-600"
            : "border-border focus:border-clay-500 focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]",
          "active:shadow-[inset_0_1px_2px_rgba(75,54,33,0.08)]",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
export { Select };
export type { SelectProps };
