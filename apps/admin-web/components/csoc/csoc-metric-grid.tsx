import Link from "next/link";
import type { ReactNode } from "react";
import { MetricCard } from "../ui";

type Metric = {
  label: string;
  value: string;
  detail?: string;
  accent?: "ink" | "eye" | "eyeOrange";
  href?: string;
};

export function CsocMetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {metrics.map((metric) => {
        const card = (
          <MetricCard label={metric.label} value={metric.value} detail={metric.detail} accent={metric.accent} />
        );
        if (!metric.href) return <div key={metric.label}>{card}</div>;
        return (
          <Link key={metric.label} href={metric.href} className="block transition-transform hover:-translate-y-0.5">
            {card}
          </Link>
        );
      })}
    </section>
  );
}

export function CsocTwoColumn({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-2">{left}{right}</div>;
}
