"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Mirrors CountriesResponse in the backend's schemas.py.
export type Origin = { code: string; name: string; default: boolean };
export type Destination = {
  code: string;
  name: string;
  document_count: number;
  checklist_available: boolean;
  eu_member: boolean;
};
export type Countries = { origins: Origin[]; destinations: Destination[] };

export const DEFAULT_ORIGIN = "NL";

// Every destination the backend accepts (countries.DESTINATIONS there), for
// the admin test panel, which must reach destinations with nothing verified
// yet. Public pages use /api/countries instead.
export const ALL_DESTINATIONS = [
  { code: "CN", name: "China" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "UK", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

export function useCountries() {
  const [countries, setCountries] = useState<Countries | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || data === null || !Array.isArray(data.destinations)) {
          setError("Couldn't load the list of destinations. Please reload the page.");
        } else {
          setCountries(data as Countries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load the list of destinations. Please reload the page.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { countries, error };
}

/** Origin and destination kept in the URL (?from=NL&to=DE), so links and
 * printouts reproduce the view. Codes are only returned when `isKnown`
 * accepts them, so a hand-edited URL can't select an unknown country. */
export function useRouteQuery(isKnownDestination: (code: string) => boolean) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTo = searchParams.get("to");
  const to = rawTo !== null && isKnownDestination(rawTo) ? rawTo : null;
  // NL is the only origin for now, whatever the URL says.
  const from = DEFAULT_ORIGIN;

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { from, to, searchParams, update };
}

export function RoutePicker({
  origins,
  destinations,
  destination,
  onDestinationChange,
  allowAll = false,
}: {
  origins: { code: string; name: string }[];
  destinations: { code: string; name: string }[];
  destination: string | null;
  onDestinationChange: (code: string | null) => void;
  allowAll?: boolean;
}) {
  const origin = origins.find((o) => o.code === DEFAULT_ORIGIN) ?? origins[0];
  return (
    <div className="flex flex-wrap gap-4">
      <label className="space-y-1">
        <span className="block text-sm font-medium">Exporting from</span>
        <select
          value={origin?.code ?? DEFAULT_ORIGIN}
          disabled
          className="border rounded p-2 bg-gray-100 text-gray-600"
        >
          {origins.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">Exporting to</span>
        <select
          value={destination ?? ""}
          onChange={(e) => onDestinationChange(e.target.value || null)}
          className="border rounded p-2"
        >
          <option value="">
            {allowAll ? "All destinations" : "Choose a destination"}
          </option>
          {destinations.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const NL_ORIGINS = [{ code: DEFAULT_ORIGIN, name: "The Netherlands" }];
