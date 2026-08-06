"use client";

import { ConsoleFilterBar, ConsoleFilterSelect } from "../console";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "PendingApproval", label: "Pending approval" },
  { value: "Published", label: "Published" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Suspended", label: "Suspended" },
  { value: "Resolved", label: "Resolved" },
  { value: "Failed", label: "Failed" },
  { value: "Draft", label: "Draft" },
];

const CATEGORY_OPTIONS = [
  { value: "Emergency", label: "Emergency" },
  { value: "Crime", label: "Crime" },
  { value: "Accident", label: "Accident" },
  { value: "MissingPerson", label: "Missing person" },
  { value: "StolenVehicle", label: "Stolen vehicle" },
  { value: "GovernmentAlert", label: "Government alert" },
  { value: "CommunityWarning", label: "Community warning" },
];

const AUTHOR_OPTIONS = [
  { value: "Citizen", label: "Citizen" },
  { value: "Admin", label: "Admin" },
];

type BroadcastFiltersProps = {
  defaultCountry?: string;
  defaultState?: string;
  defaultStatus?: string;
  defaultCategory?: string;
  defaultAuthor?: string;
};

export function BroadcastFilters({
  defaultCountry,
  defaultState,
  defaultStatus,
  defaultCategory,
  defaultAuthor,
}: BroadcastFiltersProps) {
  return (
    <ConsoleFilterBar>
      <ConsoleFilterSelect name="status" label="Status" options={STATUS_OPTIONS} defaultValue={defaultStatus} />
      <ConsoleFilterSelect name="category" label="Category" options={CATEGORY_OPTIONS} defaultValue={defaultCategory} />
      <ConsoleFilterSelect name="author" label="Author type" options={AUTHOR_OPTIONS} defaultValue={defaultAuthor} />
      <ConsoleFilterSelect
        name="country"
        label="Country"
        options={defaultCountry ? [{ value: defaultCountry, label: defaultCountry }] : []}
        defaultValue={defaultCountry}
      />
      <ConsoleFilterSelect
        name="state"
        label="State"
        options={defaultState ? [{ value: defaultState, label: defaultState }] : []}
        defaultValue={defaultState}
      />
    </ConsoleFilterBar>
  );
}
