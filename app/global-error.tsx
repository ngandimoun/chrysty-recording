"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" translate="no" className="notranslate h-full">
      <body className="notranslate flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center font-sans dark:bg-black">
        <h1 className="text-xl font-semibold">Application error</h1>
        <p className="max-w-sm text-sm opacity-70">
          Chrysty Recording hit an unexpected error. If your browser is translating
          this page, turn off auto-translate and reload — translation can break the
          app.
        </p>
        {error.digest ? (
          <p className="text-xs opacity-50">Error ID: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
