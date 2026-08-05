"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/api";

type Step = 1 | 2 | 3;
type Me = { userId: string; name: string; email: string; role: string };

const steps = ["1. Business Profile", "2. Location Details", "3. Staff Setup"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [staffTitle, setStaffTitle] = useState("Owner / Lead Specialist");

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch(() => router.push("/login"));
  }, [router]);

  async function createBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{
        businessId: string;
        name: string;
      }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          category: form.get("category"),
        }),
      });
      setBusinessId(result.businessId);
      setBusinessName(result.name);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create business");
    } finally {
      setLoading(false);
    }
  }

  async function createLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!businessId) return;
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{ locationId: string }>(
        `/businesses/${businessId}/locations`,
        {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            address: form.get("address"),
            lat: Number(form.get("lat")),
            lng: Number(form.get("lng")),
            timezone: form.get("timezone"),
          }),
        },
      );
      setLocationId(result.locationId);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add location");
    } finally {
      setLoading(false);
    }
  }

  async function createStaff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!businessId || !locationId) return;
    setError(null);
    setLoading(true);
    try {
      await api(`/businesses/${businessId}/staff`, {
        method: "POST",
        body: JSON.stringify({
          locationId,
          title: staffTitle,
        }),
      });
      router.push(`/dashboard?businessId=${businessId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ease-mesh-pastel min-h-screen text-slate-900 flex flex-col justify-between">
      <div>
        <AppHeader user={me} />
        <main className="mx-auto max-w-xl px-4 py-10 sm:py-12">
          {/* Step Progress Bar */}
          <div className="mb-8 flex items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
            {steps.map((label, i) => {
              const n = (i + 1) as Step;
              const active = step === n;
              const done = step > n;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-3.5 py-1 rounded-full border ${
                      active
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-xs"
                        : done
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {done ? "✓ " : ""}{label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-center sm:text-left">
            <span className="inline-block rounded-full bg-teal-50 border border-teal-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700 mb-2">
              Onboarding Wizard
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Set Up Your Business
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              One location and one staff member to start. Add more locations and team members anytime.
            </p>
          </div>

          <div className="ease-card-clean mt-8 p-6 sm:p-8">
            {step === 1 && (
              <form onSubmit={createBusiness} className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Business Name
                  <input
                    name="name"
                    required
                    placeholder="e.g. Apex Barber & Studio"
                    className="ease-input mt-1.5"
                  />
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Industry Category
                  <select
                    name="category"
                    defaultValue="salon"
                    className="ease-input mt-1.5"
                  >
                    <option value="salon">Hair Salon & Styling</option>
                    <option value="barber">Barbershop & Grooming</option>
                    <option value="spa">Spa & Facial</option>
                    <option value="wellness">Massage & Wellness</option>
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="ease-btn-primary w-full py-3.5 mt-2 font-bold"
                >
                  {loading ? "Saving Profile…" : "Continue to Location Details →"}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={createLocation} className="space-y-4">
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-800">
                  📍 Adding primary venue location for <strong>{businessName}</strong>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Location Title
                  <input
                    name="name"
                    defaultValue="Main Flagship Location"
                    required
                    className="ease-input mt-1.5"
                  />
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Street Address
                  <input
                    name="address"
                    required
                    placeholder="123 Commerce St, Downtown"
                    className="ease-input mt-1.5"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Latitude
                    <input
                      name="lat"
                      type="number"
                      step="any"
                    defaultValue={56.9532}
                    required
                    className="ease-input mt-1.5"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Longitude
                  <input
                    name="lng"
                    type="number"
                    step="any"
                    defaultValue={24.1165}
                    required
                    className="ease-input mt-1.5"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Timezone (IANA)
                <input
                  name="timezone"
                  defaultValue="Europe/Riga"
                  required
                  className="ease-input mt-1.5"
                />
              </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="ease-btn-primary w-full py-3.5 mt-2 font-bold"
                >
                  {loading ? "Saving Location…" : "Continue to Staff Setup →"}
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={createStaff} className="space-y-4">
                <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-xs text-teal-800">
                  👤 Linking your account as the primary staff member
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Your Professional Title
                  <input
                    value={staffTitle}
                    onChange={(e) => setStaffTitle(e.target.value)}
                    required
                    placeholder="Owner & Lead Specialist"
                    className="ease-input mt-1.5"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="ease-btn-primary w-full py-3.5 mt-2 font-bold"
                >
                  {loading ? "Completing Onboarding…" : "Complete Setup & Launch Dashboard →"}
                </button>
              </form>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Easement Inc. All rights reserved.
      </footer>
    </div>
  );
}
