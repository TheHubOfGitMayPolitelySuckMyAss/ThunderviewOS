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

export default function FulfillmentEditor(props: Props) {
  return (
    <TemplateEditor
      {...props}
      availableVariables={[
        "[member.firstname]",
        "[dinner.date]",
        "[dinner.venue]",
        "[dinner.address]",
      ]}
      sendTestEmail={sendTestEmail}
      saveTemplate={saveTemplate}
    />
  );
}
