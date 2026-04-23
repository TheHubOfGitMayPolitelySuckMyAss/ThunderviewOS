"use client";

import { useState, useTransition } from "react";
import { purchaseTicket } from "./cart/actions";
import { allowsGuestTicket } from "@/lib/ticket-rules";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldHelp } from "@/components/ui/field-help";

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
}: {
  dinnerOptions: DinnerOption[];
  defaultDinnerId: string;
  ticketLabel: string;
  ticketPrice: number;
  memberEmail: string;
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
    <div className="space-y-5">
      {/* Dinner dropdown */}
      <div>
        <Label>Which dinner?</Label>
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
          <FieldHelp className="!text-mustard-500">
            Buying a ticket for a past dinner.
          </FieldHelp>
        )}
      </div>

      {/* Buy buttons */}
      {showGuestButton ? (
        <div className="flex gap-3">
          <button
            onClick={() => handlePurchase(false)}
            disabled={isPending}
            className="flex-1 p-4 border border-border rounded-xl bg-bg text-left cursor-pointer transition-all duration-[120ms] hover:border-accent hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-semibold text-[15px] text-fg1 mb-1">{ticketLabel}</div>
            <div className="text-accent-hover font-display font-medium text-[22px] mt-2" style={{ fontVariationSettings: '"opsz" 72' }}>
              {isPending ? "Processing…" : `$${ticketPrice}`}
            </div>
          </button>
          <button
            onClick={() => handlePurchase(true)}
            disabled={isPending}
            className="flex-1 p-4 border border-border rounded-xl bg-bg text-left cursor-pointer transition-all duration-[120ms] hover:border-accent hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-semibold text-[15px] text-fg1 mb-1">{ticketLabel} + Guest</div>
            <div className="text-accent-hover font-display font-medium text-[22px] mt-2" style={{ fontVariationSettings: '"opsz" 72' }}>
              {isPending ? "Processing…" : `$${ticketPrice + 40}`}
            </div>
          </button>
        </div>
      ) : (
        <button
          onClick={() => handlePurchase(false)}
          disabled={isPending}
          className="w-full p-4 border border-border rounded-xl bg-bg text-left cursor-pointer transition-all duration-[120ms] hover:border-accent hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="font-semibold text-[15px] text-fg1 mb-1">{ticketLabel}</div>
          <div className="text-accent-hover font-display font-medium text-[22px] mt-2" style={{ fontVariationSettings: '"opsz" 72' }}>
            {isPending ? "Processing…" : `$${ticketPrice}`}
          </div>
        </button>
      )}

      <p className="text-[12.5px] text-fg3 leading-[1.5]">
        Ticket price covers the meal. You&rsquo;ll be redirected to Stripe to complete payment.
      </p>
    </div>
  );
}
