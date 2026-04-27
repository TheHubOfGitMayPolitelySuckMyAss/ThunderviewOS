"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon } from "lucide-react";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  rows?: number;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors duration-[120ms] ${
        active
          ? "bg-accent text-cream-50"
          : "text-fg2 hover:bg-bg-elevated"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  rows = 8,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need — keep only bold, italic, paragraph, hardBreak
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync disabled state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "https://");

    if (url === null) return; // Cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  const minHeight = rows * 24; // ~24px per line

  return (
    <div
      className={`rounded-lg border border-border bg-bg overflow-hidden transition-colors duration-[120ms] ${
        disabled ? "opacity-60" : "focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30"
      }`}
    >
      {/* Toolbar */}
      {!disabled && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg-elevated">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            active={editor.isActive("link")}
            onClick={setLink}
            title="Link"
          >
            <LinkIcon size={16} />
          </ToolbarButton>
        </div>
      )}

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose-sm px-3 py-2 text-fg1 [&_.tiptap]:outline-none [&_.tiptap]:min-h-[var(--min-h)] [&_.tiptap_p]:my-1.5 [&_.tiptap_a]:text-accent-hover [&_.tiptap_a]:underline"
        style={{ "--min-h": `${minHeight}px` } as React.CSSProperties}
      />
    </div>
  );
}
