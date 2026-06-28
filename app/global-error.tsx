"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center font-sans dark:bg-black">
        <h1 className="text-xl font-semibold">Application error</h1>
        <p className="max-w-sm text-sm opacity-70">{error.message}</p>
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
