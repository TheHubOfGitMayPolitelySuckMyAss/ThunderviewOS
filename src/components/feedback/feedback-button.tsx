"use client";

import { useState, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/field";
import { submitFeedback } from "./actions";

export default function FeedbackButton({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Bug" | "Feedback">("Bug");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setType("Bug");
      setMessage("");
      setName("");
      setEmail("");
      setHoneypot("");
      setSuccess(false);
    }
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = message.trim().length > 0 && (isAuthenticated || (name.trim().length > 0 && emailValid));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || sending) return;
    setSending(true);

    await submitFeedback({
      type,
      message: message.trim(),
      name: isAuthenticated ? undefined : name.trim(),
      email: isAuthenticated ? undefined : email.trim(),
      honeypot,
      url: window.location.href,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
    });

    setSending(false);
    setSuccess(true);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-accent text-cream-50 hover:bg-accent-hover font-semibold text-[13px] px-4 py-2.5 rounded-md shadow-md transition-all duration-[120ms] cursor-pointer"
      >
        <MessageSquare size={15} />
        Feedback
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-bg border border-border rounded-xl shadow-lg w-[460px] max-h-[90vh] overflow-y-auto p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display font-medium text-[22px] text-fg1 leading-tight" style={{ fontVariationSettings: '"opsz" 72' }}>
                We&rsquo;re excited to hear from you
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-fg3 hover:text-fg1 transition-colors cursor-pointer p-1 -mr-1 -mt-1"
              >
                <X size={18} />
              </button>
            </div>

            {success ? (
              <div className="rounded-md bg-[rgba(91,106,59,0.08)] border border-[rgba(91,106,59,0.2)] text-success px-4 py-3.5 text-[14px] leading-[1.5]">
                Thanks — we&rsquo;ll get back to you.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Type toggle */}
                <div className="flex gap-2 mb-form-row">
                  {(["Bug", "Feedback"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors duration-[120ms] cursor-pointer ${
                        type === t
                          ? "bg-ink-900 text-cream-50"
                          : "bg-bg-elevated text-fg2 hover:bg-bg-tinted border border-border"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Anonymous user fields */}
                {!isAuthenticated && (
                  <>
                    <Field label="Name" required>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </Field>
                    <div className="mt-form-row">
                      <Field label="Email" required>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                        />
                      </Field>
                    </div>
                  </>
                )}

                {/* Honeypot — hidden from real users */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div className={isAuthenticated ? "" : "mt-form-row"}>
                  <Field label="What do we need to know?" required>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={2000}
                      rows={5}
                      placeholder={type === "Bug" ? "What happened? What did you expect?" : "What's on your mind?"}
                      required
                    />
                    <span className="text-[12px] text-fg4 mt-1 block text-right">
                      {message.length}/2000
                    </span>
                  </Field>
                </div>

                <div className="mt-form-row flex justify-end">
                  <Button type="submit" disabled={!canSubmit || sending}>
                    {sending ? "Sending\u2026" : "Send"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
