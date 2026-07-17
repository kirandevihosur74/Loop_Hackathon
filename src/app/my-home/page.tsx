import { Screen } from "@/components/layout/Screen";

// Route shell — replaced by the My Home screen build.
export default function MyHomePage() {
  return (
    <Screen>
      <h1 className="text-xl font-bold text-ink">My Home</h1>
      <p className="mt-1 text-sm text-sub">Your appliances &amp; bill — coming together.</p>
    </Screen>
  );
}
