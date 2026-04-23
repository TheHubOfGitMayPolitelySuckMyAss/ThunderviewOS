"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDate, formatTicketName, getTodayMT } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { refundTicket, creditTicket } from "./actions";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";

type TicketRow = {
  id: string;
  memberId: string | null;
  memberName: string;
  primaryEmail: string;
  displayStatus: string;
  fulfillmentStatus: string;
  purchasedAt: string;
  quantity: number;
  amountPaid: number;
  memberFirstName: string;
  memberLastName: string;
  profilePicUrl: string | null;
  isFirstTicket: boolean;
  paymentSource: string;
};

function StatusPill({ status }: { status: string }) {
  const variant = {
    Purchased: "neutral" as const,
    Fulfilled: "success" as const,
    "Intro/Ask": "success" as const,
    Refunded: "danger" as const,
    Credited: "warn" as const,
  }[status] ?? "neutral" as const;

  return <Pill variant={variant} dot>{status}</Pill>;
}

const thClass = "text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-fg3 px-3.5 py-2.5 bg-bg-elevated border-b border-border sticky top-0 z-10";

export default function DinnerTickets({
  tickets,
  dinnerDate,
}: {
  tickets: TicketRow[];
  dinnerDate: string;
}) {
  const activeTickets = tickets.filter(
    (t) => t.fulfillmentStatus === "purchased" || t.fulfillmentStatus === "fulfilled"
  );
  const inactiveTickets = tickets.filter(
    (t) => t.fulfillmentStatus === "refunded" || t.fulfillmentStatus === "credited"
  );

  return (
    <>
      {/* Active tickets table */}
      <div>
        <h3 className="tv-h4 mb-3">Tickets</h3>
        <div className="overflow-hidden rounded-xl border border-border bg-bg">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Purchased</th>
                <th className={`${thClass} !text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTickets.map((ticket) => (
                <ActiveTicketRow key={ticket.id} ticket={ticket} dinnerDate={dinnerDate} />
              ))}
              {activeTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6 text-center text-sm text-fg4">
                    No active tickets for this dinner.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refunded / Credited section */}
      {inactiveTickets.length > 0 && (
        <div>
          <h3 className="tv-h4 mb-3">Refunded / Credited</h3>
          <div className="overflow-hidden rounded-xl border border-border bg-bg">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Purchased</th>
                </tr>
              </thead>
              <tbody>
                {inactiveTickets.map((ticket) => (
                  <tr key={ticket.id} className="line-through text-fg4 border-b border-border-subtle last:border-b-0">
                    <td className="px-3.5 py-3 text-sm">
                      {ticket.memberId ? (
                        <Link href={`/admin/members/${ticket.memberId}`} className="no-underline text-fg4 hover:text-fg3">
                          {formatTicketName(ticket.memberName, ticket.quantity)}
                        </Link>
                      ) : "\u2014"}
                    </td>
                    <td className="px-3.5 py-3 text-sm">{ticket.primaryEmail}</td>
                    <td className="px-3.5 py-3 text-sm"><StatusPill status={ticket.displayStatus} /></td>
                    <td className="px-3.5 py-3 text-sm">{formatDate(ticket.purchasedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function ActiveTicketRow({ ticket, dinnerDate }: { ticket: TicketRow; dinnerDate: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<"refund" | "credit" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const isPastDinner = dinnerDate < getTodayMT();
  const isQty2 = ticket.quantity >= 2;
  const guestRefundAmount = (40).toFixed(2);
  const fullRefundAmount = Number(ticket.amountPaid).toFixed(2);

  function handleRefund(mode: "full" | "guest_only") {
    setActionError(null);
    startTransition(async () => {
      const result = await refundTicket(ticket.id, mode);
      if (result.success) {
        setModal(null);
        router.refresh();
      } else {
        setActionError(result.error || "Refund failed");
      }
    });
  }

  function handleCredit() {
    setActionError(null);
    startTransition(async () => {
      const result = await creditTicket(ticket.id);
      if (result.success) {
        setModal(null);
        router.refresh();
      } else {
        setActionError(result.error || "Credit failed");
      }
    });
  }

  return (
    <>
      <tr className="border-b border-border-subtle last:border-b-0 hover:bg-bg-elevated">
        <td className="px-3.5 py-3 text-sm text-fg1">
          {ticket.memberId ? (
            <Link
              href={`/admin/members/${ticket.memberId}`}
              className="flex items-center gap-2 no-underline text-fg1 hover:underline"
            >
              <MemberAvatar member={{ first_name: ticket.memberFirstName, last_name: ticket.memberLastName, profile_pic_url: ticket.profilePicUrl }} size="sm" />
              {formatTicketName(ticket.memberName, ticket.quantity)}
              {ticket.isFirstTicket && (
                <Pill variant="accent" className="!py-0 !px-1.5 !text-[10px]">new</Pill>
              )}
            </Link>
          ) : "\u2014"}
        </td>
        <td className="px-3.5 py-3 text-sm text-fg2">{ticket.primaryEmail}</td>
        <td className="px-3.5 py-3 text-sm"><StatusPill status={ticket.displayStatus} /></td>
        <td className="px-3.5 py-3 text-sm text-fg2">{formatDate(ticket.purchasedAt)}</td>
        <td className="px-3.5 py-3 text-right text-sm">
          {ticket.paymentSource !== "comp" && !isPastDinner && (
            <div className="flex justify-end gap-2">
              {!isQty2 && (
                <button
                  onClick={() => { setActionError(null); setModal("credit"); }}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium text-fg2 cursor-pointer hover:bg-bg-elevated"
                >
                  Credit
                </button>
              )}
              <button
                onClick={() => { setActionError(null); setModal("refund"); }}
                className="rounded-md border border-ember-600/30 px-3 py-1 text-xs font-medium text-ember-600 cursor-pointer hover:bg-ember-600/[0.08]"
              >
                Refund
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Refund modal */}
      {modal === "refund" && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-sm rounded-lg bg-bg border border-border p-6 shadow-lg">
                {actionError && (
                  <div className="mb-3 rounded-md bg-[#F2D4CB] p-3 text-xs text-ember-600">
                    {actionError}
                  </div>
                )}
                {isQty2 ? (
                  <>
                    <p className="text-sm text-fg1">
                      This ticket has a guest (+1). How many would you like to refund?
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        variant="secondary"
                        className="!text-ember-600 !border-ember-600/30 hover:!bg-ember-600/[0.08] w-full justify-center"
                        onClick={() => handleRefund("guest_only")}
                        disabled={isPending}
                      >
                        {isPending ? "…" : `Refund Guest Only ($${guestRefundAmount})`}
                      </Button>
                      <Button
                        className="!bg-ember-600 hover:!bg-ember-600/90 w-full justify-center"
                        onClick={() => handleRefund("full")}
                        disabled={isPending}
                      >
                        {isPending ? "…" : `Refund Both ($${fullRefundAmount})`}
                      </Button>
                      <Button variant="secondary" className="w-full justify-center" onClick={() => setModal(null)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-fg1">
                      Refund this ticket? This will set the status to refunded.
                    </p>
                    <div className="mt-4 flex justify-end gap-3">
                      <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="!bg-ember-600 hover:!bg-ember-600/90"
                        onClick={() => handleRefund("full")}
                        disabled={isPending}
                      >
                        {isPending ? "…" : "Confirm Refund"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Credit modal */}
      {modal === "credit" && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-sm rounded-lg bg-bg border border-border p-6 shadow-lg">
                {actionError && (
                  <div className="mb-3 rounded-md bg-[#F2D4CB] p-3 text-xs text-ember-600">
                    {actionError}
                  </div>
                )}
                <p className="text-sm text-fg1">
                  Credit this ticket? A credit will be issued to{" "}
                  <strong>{ticket.memberName}</strong> for a future dinner.
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Cancel</Button>
                  <Button size="sm" onClick={handleCredit} disabled={isPending}>
                    {isPending ? "…" : "Confirm Credit"}
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
