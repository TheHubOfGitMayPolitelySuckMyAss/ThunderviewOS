import { Label } from "@/components/ui/label";
import { FieldHelp } from "@/components/ui/field-help";

type FieldProps = {
  label: string;
  required?: boolean;
  help?: string | React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Field({
  label,
  required,
  help,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-label-input ${className}`}>
      <Label required={required} className="!mb-0">{label}</Label>
      {!error && help && (
        typeof help === "string"
          ? <FieldHelp className="!mt-0">{help}</FieldHelp>
          : help
      )}
      {children}
      {error && <FieldHelp error className="!mt-0">{error}</FieldHelp>}
    </div>
  );
}
