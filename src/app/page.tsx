import { Screen } from "@/components/layout/Screen";

// Route shell — replaced by the Home screen build.
export default function HomePage() {
  return (
    <Screen>
      <h1 className="text-xl font-bold text-ink">Home</h1>
      <p className="mt-1 text-sm text-sub">Living Home — coming together.</p>
    </Screen>
  );
}
