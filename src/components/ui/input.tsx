import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          "w-full font-sans text-[15px] text-fg1 bg-bg border rounded-md px-3.5 py-[11px] outline-none transition-[border-color,box-shadow] duration-[120ms]",
          error
            ? "border-ember-600"
            : "border-border focus:border-accent focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]",
          "active:shadow-[inset_0_1px_2px_rgba(75,54,33,0.08)]",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
export { Input };
export type { InputProps };
