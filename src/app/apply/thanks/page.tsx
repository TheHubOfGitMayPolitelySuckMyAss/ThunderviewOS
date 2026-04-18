import ConfettiEffect from "./confetti";

export default function ThanksPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Thanks for applying!
        </h1>
        <p className="text-sm leading-relaxed text-gray-700">
          We&rsquo;ll review your application and get back to you soon. If you
          have questions in the meantime, email{" "}
          <a
            href="mailto:eric@marcoullier.com"
            className="text-blue-600 hover:text-blue-800"
          >
            eric@marcoullier.com
          </a>
          .
        </p>
      </div>
      <ConfettiEffect />
    </div>
  );
}
