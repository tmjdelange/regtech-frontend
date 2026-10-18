"use client";

import Link from "next/link";
import { useState } from "react";
import { RoutePicker, useCountries, useRouteQuery } from "../lib/countries";

type SearchResult = {
  id: number;
  title: string | null;
  country: string | null;
  content: string;
  distance: number;
};

export default function SearchPage() {
  const { countries, error: countriesError } = useCountries();
  const destinations = countries?.destinations ?? [];
  const { from, to, update } = useRouteQuery((code) =>
    destinations.some((d) => d.code === code)
  );
  const destination = destinations.find((d) => d.code === to) ?? null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search(q: string, dest: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const qs = new URLSearchParams({ query: q, destination: dest, origin: from });
      const res = await fetch(`/api/search?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setSearchError("Search failed. Please try again in a moment.");
        setResults([]);
      } else {
        setResults(data);
      }
      setSearched(true);
    } catch {
      setSearchError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onDestinationChange(code: string | null) {
    update({ to: code });
    setResults([]);
    setSearched(false);
  }

  function onSearch() {
    if (!to || !query.trim()) return;
    search(query, to);
  }

  const checkHref = to ? `/check?from=${from}&to=${to}` : "/check";

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Regtech Document Search</h1>

      <section className="space-y-2">
        {countriesError && <p className="text-sm text-red-600">{countriesError}</p>}
        {countries && (
          <RoutePicker
            origins={countries.origins}
            destinations={destinations}
            destination={to}
            onDestinationChange={onDestinationChange}
          />
        )}
      </section>

      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold">
          {destination
            ? `Exporting a soft drink to ${destination.name}?`
            : "Exporting a soft drink?"}
        </h2>
        <p className="text-gray-700">
          Answer a few questions and get a checklist of what to act on.
        </p>
        <Link
          href={checkHref}
          className="inline-block bg-black text-white px-4 py-2 rounded"
        >
          Check my product
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Search</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
        >
          <input
            className="flex-1 border rounded p-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={destination ? `Search requirements for ${destination.name}...` : "Search documents..."}
            disabled={!to}
          />
          <button
            type="submit"
            disabled={!to}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-60"
          >
            Search
          </button>
        </form>
        {!to && countries && (
          <p className="text-sm text-gray-600">Choose where you&apos;re exporting to before searching.</p>
        )}

        {loading && <p>Searching...</p>}
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}
        {!loading && !searchError && searched && results.length === 0 && (
          <p className="text-gray-500">No relevant requirements found.</p>
        )}

        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="border rounded p-3 space-y-1">
              {r.title && <p className="font-medium">{r.title}</p>}
              <p>{r.content}</p>
              <p className="text-sm text-gray-500">
                {r.country === "EU" ? "Applies across the EU · " : ""}
                distance: {r.distance.toFixed(4)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
