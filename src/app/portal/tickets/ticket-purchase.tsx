"use client";

import { useState, useTransition } from "react";
import { purchaseTicket } from "./cart/actions";

type DinnerOption = {
  id: string;
  date: string;
  label: string;
  isPast: boolean;
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
  const isDecember = selectedDinner
    ? new Date(selectedDinner.date + "T00:00:00").getMonth() === 11
    : false;

  function handlePurchase(withGuest: boolean) {
    const formData = new FormData();
    formData.set("dinner_id", selectedDinnerId);
    formData.set("with_guest", String(withGuest));
    startTransition(() => purchaseTicket(formData));
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Dinner dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Select Dinner
        </label>
        <select
          value={selectedDinnerId}
          onChange={(e) => setSelectedDinnerId(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {dinnerOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        {selectedDinner?.isPast && (
          <p className="mt-1 text-xs text-amber-600">
            Buying a ticket for a past dinner.
          </p>
        )}
      </div>

      {/* Ticket info + buy buttons */}
      <div className="rounded-lg border-2 border-gray-200 bg-white px-6 py-6 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">{ticketLabel}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">${ticketPrice}</p>
        {memberEmail && (
          <p className="mt-1 text-xs text-gray-400">
            Receipt to {memberEmail}
          </p>
        )}

        <div className="mt-6">
          {isDecember ? (
            <div className="flex gap-3">
              <button
                onClick={() => handlePurchase(false)}
                disabled={isPending}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending ? "Processing..." : `Buy Ticket — $${ticketPrice}`}
              </button>
              <button
                onClick={() => handlePurchase(true)}
                disabled={isPending}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending
                  ? "Processing..."
                  : `Buy Ticket + Guest — $${ticketPrice + 40}`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePurchase(false)}
              disabled={isPending}
              className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? "Processing..." : "Buy Ticket"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
