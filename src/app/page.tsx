"use client";

import { useState } from "react";

type SearchResult = {
  id: number;
  content: string;
  distance: number;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data);
    setSearched(true);
    setLoading(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Regtech Document Search</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Search</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
          />
          <button
            onClick={search}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>

        {loading && <p>Searching...</p>}
        {!loading && searched && results.length === 0 && (
          <p className="text-gray-500">No results found.</p>
        )}

        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="border rounded p-3">
              <p>{r.content}</p>
              <p className="text-sm text-gray-500">
                distance: {r.distance.toFixed(4)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}