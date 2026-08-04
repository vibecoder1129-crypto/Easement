import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-slate-600">
          Loading…
        </div>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
