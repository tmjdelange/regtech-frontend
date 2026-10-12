import type { Metadata } from "next";
import ProductChecker from "./ProductChecker";

export const metadata: Metadata = {
  title: "Check my product",
  description: "UK import checklist for soft drinks at or below 1.2% ABV",
};

export default function CheckPage() {
  return <ProductChecker />;
}
