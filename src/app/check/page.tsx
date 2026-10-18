import type { Metadata } from "next";
import { Suspense } from "react";
import ProductChecker from "./ProductChecker";

export const metadata: Metadata = {
  title: "Check my product",
  description: "Export checklist for soft drinks at or below 1.2% ABV",
};

export default function CheckPage() {
  // ProductChecker reads ?from=&to= with useSearchParams, which needs a
  // Suspense boundary so the page can still be prerendered.
  return (
    <Suspense fallback={<main className="max-w-2xl mx-auto p-8">Loading…</main>}>
      <ProductChecker />
    </Suspense>
  );
}
