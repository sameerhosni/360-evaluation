"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { SORT_OPTIONS, DEFAULT_SORT, type CockpitFilterOption } from "@/lib/cockpit-filters";

export function CockpitFilters({
  cycles,
  activeCycleId,
  totalReports,
  filteredCount,
  labels,
}: {
  cycles: CockpitFilterOption[];
  activeCycleId: string;
  totalReports: number;
  filteredCount: number;
  labels?: {
    searchPlaceholder?: string;
    sort?: string;
    period?: string;
    noCycles?: string;
    reports?: string;
    reset?: string;
    sortOptions?: CockpitFilterOption[];
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentSort = params.get("sort") ?? DEFAULT_SORT;
  const currentQ = params.get("q") ?? "";
  const currentCycle = params.get("cycle") ?? activeCycleId;

  const [q, setQ] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value && value.length > 0) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== currentQ) updateParam("q", q);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = filteredCount !== totalReports;
  const sortOptions = labels?.sortOptions ?? SORT_OPTIONS;

  return (
    <div className="card p-4 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
      <div className="relative flex-1">
        <svg
          className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels?.searchPlaceholder ?? "Search by name…"}
          className="w-full ps-10 pe-3 py-2.5 bg-white border border-soft rounded-lg text-[14px] text-ink-900 placeholder-ink-400 focus:border-gold-500 transition"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); updateParam("q", null); }}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900 text-[13px] px-1"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <label className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold whitespace-nowrap">
          {labels?.sort ?? "Sort"}
        </label>
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value === DEFAULT_SORT ? null : e.target.value)}
          className="bg-white border border-soft rounded-lg px-3 py-2 text-[13px] text-ink-900 focus:border-gold-500 transition"
        >
          {sortOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <label className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold whitespace-nowrap">
          {labels?.period ?? "Period"}
        </label>
        <select
          value={currentCycle}
          onChange={(e) => updateParam("cycle", e.target.value === activeCycleId ? null : e.target.value)}
          className="bg-white border border-soft rounded-lg px-3 py-2 text-[13px] text-ink-900 focus:border-gold-500 transition"
          disabled={cycles.length <= 1}
        >
          {cycles.length === 0 ? (
            <option value="">{labels?.noCycles ?? "No cycles"}</option>
          ) : (
            cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))
          )}
        </select>
      </div>

      <div className="flex items-center gap-3 ms-auto md:ms-0">
        <div className="text-[12px] text-ink-500 whitespace-nowrap">
          {filtered ? (
            <>
              <span className="font-semibold text-ink-900">{filteredCount}</span>
              <span className="text-ink-400"> / {totalReports}</span>
            </>
          ) : (
            <span>
              <span className="font-semibold text-ink-900">{totalReports}</span>{" "}
              {labels?.reports ?? "reports"}
            </span>
          )}
        </div>
        {(currentSort !== DEFAULT_SORT || currentQ || currentCycle !== activeCycleId) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              router.push(pathname);
            }}
            className="text-[12px] text-gold-700 hover:text-gold-600 font-medium whitespace-nowrap"
          >
            {labels?.reset ?? "Reset"}
          </button>
        )}
      </div>
    </div>
  );
}
