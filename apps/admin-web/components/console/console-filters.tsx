"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function ConsoleFilterBar({ children }: { children: ReactNode }) {
  return <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</form>;
}

export function ConsoleFilterSelect({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? searchParams.get(name) ?? ""}
        className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          const value = event.target.value;
          if (value) params.set(name, value);
          else params.delete(name);
          params.delete("cursor");
          params.delete("history");
          router.push(`?${params.toString()}`);
        }}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ConsoleSearchInput({
  name = "q",
  label = "Search",
  placeholder,
  defaultValue,
}: {
  name?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="grid gap-1 text-sm md:col-span-2">
      <span className="font-medium text-muted">{label}</span>
      <input
        name={name}
        type="search"
        defaultValue={defaultValue ?? searchParams.get(name) ?? ""}
        placeholder={placeholder}
        className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const value = (event.currentTarget as HTMLInputElement).value.trim();
          const params = new URLSearchParams(searchParams.toString());
          if (value) params.set(name, value);
          else params.delete(name);
          params.delete("cursor");
          params.delete("history");
          router.push(`?${params.toString()}`);
        }}
      />
    </label>
  );
}

export function ConsoleViewSwitcher({
  name = "view",
  options,
}: {
  name?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get(name) ?? options[0]?.value ?? "table";

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="View type">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active === option.value}
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            active === option.value ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"
          }`}
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(name, option.value);
            params.delete("cursor");
            router.push(`?${params.toString()}`);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
