import { Suspense } from "react";
import SearchPage from "./SearchPage";

export default function Home() {
  // SearchPage reads ?from=&to= with useSearchParams, which needs a Suspense
  // boundary so the rest of the page can still be prerendered.
  return (
    <Suspense fallback={<main className="max-w-2xl mx-auto p-8">Loading…</main>}>
      <SearchPage />
    </Suspense>
  );
}
