import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-praxd-bg text-praxd-text space-y-4">
      <h2 className="text-xl font-semibold">Page Not Found</h2>
      <p className="text-sm text-praxd-text-muted">
        The requested resource could not be found.
      </p>
      <Link
        href="/"
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
