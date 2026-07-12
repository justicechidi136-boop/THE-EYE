import type { ReactNode } from "react";
import { MetricCard } from "../ui";

type Metric = {
  label: string;
  value: string;
  detail?: string;
  accent?: "ink" | "eye" | "eyeOrange";
};

export function CsocMetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} accent={metric.accent} />
      ))}
    </section>
  );
}

export function CsocTwoColumn({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-2">{left}{right}</div>;
}
