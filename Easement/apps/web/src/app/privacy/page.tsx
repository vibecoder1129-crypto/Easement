import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function PrivacyPage() {
  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold">Privacy</h1>
        <p className="mt-3 text-sm text-[var(--ease-text-muted)] leading-relaxed">
          Easement stores the account details you provide (name, email, phone)
          and booking history so you can manage appointments. We do not sell
          personal data. Session cookies keep you signed in securely.
        </p>
        <p className="mt-3 text-sm text-[var(--ease-text-muted)] leading-relaxed">
          Business owners see client contact details only for bookings at their
          venue. You can update or delete your account in Settings.
        </p>
        <Link href="/" className="inline-block mt-8 text-sm font-bold text-indigo-600">
          ← Back home
        </Link>
      </main>
    </div>
  );
}
