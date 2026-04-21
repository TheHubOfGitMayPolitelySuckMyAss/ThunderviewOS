"use client";

import TemplateEditor from "../template-editor";
import { sendTestEmail, saveTemplate } from "./actions";

interface Props {
  slug: string;
  initialSubject: string;
  initialBody: string;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
}

export default function RejectionEditor(props: Props) {
  return (
    <TemplateEditor
      {...props}
      availableVariables={["[applicant.firstname]"]}
      sendTestEmail={sendTestEmail}
      saveTemplate={saveTemplate}
    />
  );
}
