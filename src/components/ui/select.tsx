import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = "", children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={[
            "w-full font-sans text-[15px] text-fg1 bg-bg border rounded-md pl-3.5 pr-9 py-[11px] outline-none transition-[border-color,box-shadow] duration-[120ms] appearance-none",
            error
              ? "border-ember-600"
              : "border-border focus:border-accent focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]",
            "active:shadow-[inset_0_1px_2px_rgba(75,54,33,0.08)]",
            className,
          ].join(" ")}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg2"
        />
      </div>
    );
  }
);

Select.displayName = "Select";
export { Select };
export type { SelectProps };
