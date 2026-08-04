import { Suspense } from "react";
import MyBookingsClient from "./MyBookingsClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-slate-600">
          Loading…
        </div>
      }
    >
      <MyBookingsClient />
    </Suspense>
  );
}
