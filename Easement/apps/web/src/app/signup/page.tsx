import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-slate-600">
          Loading…
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
