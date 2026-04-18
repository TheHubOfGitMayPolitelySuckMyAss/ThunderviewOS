import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Thunderview CEO Dinners
        </h1>
        <p className="mt-3 text-gray-600">
          Monthly dinners for Colorado startup CEOs.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/apply"
            className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Apply to attend
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
