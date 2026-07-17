"use client";

import type { PricePoint } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";
import { ThemeToggle } from "@/components/ui";
import PriceForecastChart from "./PriceForecastChart";

/**
 * Home hero: the calm address header with the day/night toggle, above a
 * weather-style price-forecast card you can drag to read the price at any hour.
 * The card's palette follows the theme (warm by day, cool by night).
 */
export function HomeHero({ forecast, nowHour }: { forecast: PricePoint[]; nowHour: number }) {
  const { theme } = useTheme();

  return (
    <header>
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">123 Maple St</h1>
          <p className="text-sm text-sub">San Jose</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-3 px-3.5">
        <PriceForecastChart data={forecast} nowHour={nowHour} night={theme === "night"} />
      </div>
    </header>
  );
}
