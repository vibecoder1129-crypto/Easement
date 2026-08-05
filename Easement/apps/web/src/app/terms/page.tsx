import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function TermsPage() {
  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold">Terms</h1>
        <p className="mt-3 text-sm text-[var(--ease-text-muted)] leading-relaxed">
          Easement is an appointment marketplace. Payment is handled at the
          venue unless a business states otherwise. Cancelling or rescheduling
          follows each business’s availability rules in the app.
        </p>
        <p className="mt-3 text-sm text-[var(--ease-text-muted)] leading-relaxed">
          Business listings must be accurate. We may suspend accounts that
          misuse the platform or harm other users.
        </p>
        <Link href="/" className="inline-block mt-8 text-sm font-bold text-indigo-600">
          ← Back home
        </Link>
      </main>
    </div>
  );
}
