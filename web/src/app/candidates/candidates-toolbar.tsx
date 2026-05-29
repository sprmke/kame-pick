"use client";

import { CandidatesFilters } from "@/app/candidates/candidates-filters";

export function CandidatesToolbar() {
  return (
    <div className="mb-4">
      <CandidatesFilters />
    </div>
  );
}
