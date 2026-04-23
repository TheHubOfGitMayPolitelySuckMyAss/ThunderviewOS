import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          "w-full font-sans text-[15px] text-fg1 bg-bg border rounded-md px-3.5 py-[11px] outline-none resize-y min-h-[90px] leading-[1.5] transition-[border-color,box-shadow] duration-[120ms]",
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

Textarea.displayName = "Textarea";
export { Textarea };
export type { TextareaProps };
