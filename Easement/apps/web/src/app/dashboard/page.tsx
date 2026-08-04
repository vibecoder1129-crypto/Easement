import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-600">Loading…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
