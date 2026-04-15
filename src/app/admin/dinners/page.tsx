import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DinnersPage() {
  const supabase = await createClient();
  const { data: dinners } = await supabase
    .from("dinners")
    .select("*")
    .order("date", { ascending: true });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Dinners</h2>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Venue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dinners?.map((dinner) => (
              <tr key={dinner.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {new Date(dinner.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {dinner.venue}
                </td>
                <td className="px-6 py-4 text-sm">
                  <Link
                    href={`/admin/dinners/${dinner.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!dinners || dinners.length === 0) && (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-8 text-center text-sm text-gray-400"
                >
                  No dinners found. Run the seed script to generate dinner
                  dates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
