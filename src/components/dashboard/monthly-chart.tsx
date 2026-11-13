"use client";

import { useSyncExternalStore } from "react";
import { ChartTooltip } from "./chart-tooltip";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

// Стовпчики за місяцями навчального року (recharts). Підсвічено поточний місяць; підказка показує число. Колір береться з
// токенів через var(--…), текст осей — muted-foreground. Анімація вимикається при reduced-motion і в режимі «спокійний».
const subscribe = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    query.removeEventListener("change", notify);
    observer.disconnect();
  };
};
const animated = () => document.documentElement.dataset.motion !== "calm" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MonthlyChart({
  labels,
  values,
  highlight,
  unit,
  height = 150,
}: {
  labels: readonly string[];
  values: number[];
  highlight: number;
  unit: string;
  height?: number;
}) {
  const animate = useSyncExternalStore(subscribe, animated, () => false);
  const data = labels.map((label, index) => ({ label, value: values[index] ?? 0 }));
  const summary = data.map((item) => `${item.label}: ${item.value}`).join(", ");

  return (
    <div role="img" aria-label={`Діаграма за місяцями (${unit}): ${summary}`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <BarChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit={unit} />} />
          <Bar
            dataKey="value"
            radius={[8, 8, 3, 3]}
            maxBarSize={30}
            isAnimationActive={animate}
            animationDuration={1500}
            animationBegin={500}
            label={{ position: "top", fontSize: 11, fill: "var(--foreground)" }}
          >
            {data.map((item, index) => (
              <Cell key={item.label} fill={index === highlight ? "var(--primary)" : "var(--accent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
