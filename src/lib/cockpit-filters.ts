// Sort/filter constants shared between the Cockpit page (server component)
// and the CockpitFilters client component. Lives in /lib so the server file
// doesn't reach into a 'use client' module for non-serializable exports.

export type CockpitFilterOption = { id: string; label: string };

export const SORT_OPTIONS: CockpitFilterOption[] = [
  { id: "pulse_desc", label: "Highest Pulse first" },
  { id: "pulse_asc",  label: "Lowest Pulse first" },
  { id: "conf_asc",   label: "Lowest Confidence first  (review priority)" },
  { id: "conf_desc",  label: "Highest Confidence first" },
  { id: "name_asc",   label: "Name A → Z" },
  { id: "name_desc",  label: "Name Z → A" },
];

export const DEFAULT_SORT = "conf_asc";
