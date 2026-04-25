"use client";

import { useState, useTransition } from "react";
import { purchaseTicket } from "./cart/actions";
import { allowsGuestTicket } from "@/lib/ticket-rules";
import { Select } from "@/components/ui/select";
import { FieldHelp } from "@/components/ui/field-help";
import Field from "@/components/field";

type DinnerOption = {
  id: string;
  date: string;
  label: string;
  isPast: boolean;
  guestsAllowed: boolean;
};

export default function TicketPurchase({
  dinnerOptions,
  defaultDinnerId,
  ticketLabel,
  ticketPrice,
  memberEmail,
  hideSelector,
}: {
  dinnerOptions: DinnerOption[];
  defaultDinnerId: string;
  ticketLabel: string;
  ticketPrice: number;
  memberEmail: string;
  hideSelector?: boolean;
}) {
  const [selectedDinnerId, setSelectedDinnerId] = useState(defaultDinnerId);
  const [isPending, startTransition] = useTransition();

  const selectedDinner = dinnerOptions.find((d) => d.id === selectedDinnerId);
  const showGuestButton = selectedDinner
    ? allowsGuestTicket({ guests_allowed: selectedDinner.guestsAllowed })
    : false;

  function handlePurchase(withGuest: boolean) {
    const formData = new FormData();
    formData.set("dinner_id", selectedDinnerId);
    formData.set("with_guest", String(withGuest));
    startTransition(() => purchaseTicket(formData));
  }

  return (
    <div className="flex flex-col gap-stack">
      {/* Dinner dropdown — hidden when only selling for one dinner */}
      {!hideSelector && (
        <Field label="Which dinner?">
          <Select
            value={selectedDinnerId}
            onChange={(e) => setSelectedDinnerId(e.target.value)}
          >
            {dinnerOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} — ${ticketPrice}
              </option>
            ))}
          </Select>
          {selectedDinner?.isPast && (
            <FieldHelp className="!text-mustard-500 !mt-0">
              Buying a ticket for a past dinner.
            </FieldHelp>
          )}
        </Field>
      )}

      {/* Buy buttons — stacked */}
      <div className="flex flex-col gap-tight">
        <button
          onClick={() => handlePurchase(false)}
          disabled={isPending}
          className="w-full p-form-row border border-border rounded-xl bg-bg text-left cursor-pointer transition-all duration-[120ms] hover:border-accent hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="font-semibold text-sm text-fg1">{ticketLabel}</div>
          <div className="text-accent-hover font-display font-medium text-lg mt-label-input" style={{ fontVariationSettings: '"opsz" 72' }}>
            {isPending ? "Processing\u2026" : `$${ticketPrice}`}
          </div>
        </button>
        {showGuestButton && (
          <button
            onClick={() => handlePurchase(true)}
            disabled={isPending}
            className="w-full p-form-row border border-border rounded-xl bg-bg text-left cursor-pointer transition-all duration-[120ms] hover:border-accent hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-semibold text-sm text-fg1">{ticketLabel} + Guest</div>
            <div className="text-accent-hover font-display font-medium text-lg mt-label-input" style={{ fontVariationSettings: '"opsz" 72' }}>
              {isPending ? "Processing\u2026" : `$${ticketPrice + 40}`}
            </div>
          </button>
        )}
      </div>

      <p className="text-xs text-fg3 leading-[1.5]">
        Ticket price covers the meal. You&rsquo;ll be redirected to Stripe to complete payment.
      </p>
    </div>
  );
}
