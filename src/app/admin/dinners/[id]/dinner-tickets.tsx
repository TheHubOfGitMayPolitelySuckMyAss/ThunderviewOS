"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDate, formatTicketName } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { refundTicket, creditTicket } from "./actions";
import { useRouter } from "next/navigation";

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Purchased: "bg-yellow-100 text-yellow-800",
    Fulfilled: "bg-green-100 text-green-800",
    "Intro/Ask": "bg-purple-100 text-purple-700",
    Refunded: "bg-red-100 text-red-800",
    Credited: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

export default function DinnerTickets({
  tickets,
}: {
  tickets: TicketRow[];
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
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Tickets</h3>
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Purchased
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeTickets.map((ticket) => (
                <ActiveTicketRow key={ticket.id} ticket={ticket} />
              ))}
              {activeTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-400"
                  >
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
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Refunded / Credited
          </h3>
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Purchased
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inactiveTickets.map((ticket) => (
                  <tr key={ticket.id} className="line-through text-gray-400">
                    <td className="px-4 py-3 text-sm">
                      {ticket.memberId ? (
                        <Link
                          href={`/admin/members/${ticket.memberId}`}
                          className="hover:text-gray-600"
                        >
                          {formatTicketName(ticket.memberName, ticket.quantity)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {ticket.primaryEmail}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={ticket.displayStatus} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(ticket.purchasedAt)}
                    </td>
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

function ActiveTicketRow({ ticket }: { ticket: TicketRow }) {
  const router = useRouter();
  const [modal, setModal] = useState<"refund" | "credit" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

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
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-900">
          {ticket.memberId ? (
            <Link
              href={`/admin/members/${ticket.memberId}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <MemberAvatar member={{ first_name: ticket.memberFirstName, last_name: ticket.memberLastName, profile_pic_url: ticket.profilePicUrl }} size="sm" />
              {formatTicketName(ticket.memberName, ticket.quantity)}
              {ticket.isFirstTicket && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  new
                </span>
              )}
            </Link>
          ) : (
            "-"
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {ticket.primaryEmail}
        </td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge status={ticket.displayStatus} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {formatDate(ticket.purchasedAt)}
        </td>
        <td className="px-4 py-3 text-right text-sm">
          {ticket.paymentSource !== "comp" && (
            <div className="flex justify-end gap-2">
              {!isQty2 && (
                <button
                  onClick={() => { setActionError(null); setModal("credit"); }}
                  className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Credit
                </button>
              )}
              <button
                onClick={() => { setActionError(null); setModal("refund"); }}
                className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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
              <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                {actionError && (
                  <div className="mb-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
                    {actionError}
                  </div>
                )}
                {isQty2 ? (
                  <>
                    <p className="text-sm text-gray-900">
                      This ticket has a guest (+1). How many would you like to
                      refund?
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={() => handleRefund("guest_only")}
                        disabled={isPending}
                        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isPending ? "..." : `Refund Guest Only ($${guestRefundAmount})`}
                      </button>
                      <button
                        onClick={() => handleRefund("full")}
                        disabled={isPending}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isPending ? "..." : `Refund Both ($${fullRefundAmount})`}
                      </button>
                      <button
                        onClick={() => setModal(null)}
                        className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-900">
                      Refund this ticket? This will set the status to refunded.
                    </p>
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        onClick={() => setModal(null)}
                        className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRefund("full")}
                        disabled={isPending}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isPending ? "..." : "Confirm Refund"}
                      </button>
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
              <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                {actionError && (
                  <div className="mb-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
                    {actionError}
                  </div>
                )}
                <p className="text-sm text-gray-900">
                  Credit this ticket? A credit will be issued to{" "}
                  <strong>{ticket.memberName}</strong> for a future dinner.
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCredit}
                    disabled={isPending}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? "..." : "Confirm Credit"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
