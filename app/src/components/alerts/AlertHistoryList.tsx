"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import type { DataEnvelope } from "@/types/api";
import type { AlertHistoryResponse, AlertEventStatus } from "@/types/alert";
import AlertHistoryRow from "./AlertHistoryRow";

const ITEMS_PER_PAGE = 20;

interface AlertHistoryListProps {
  orgSlug: string;
  projectSlug: string;
}

// Filter button component
function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// Loading skeleton for history row
function HistoryRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
      <div className="h-5 w-5 animate-pulse rounded bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

// Empty state component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-4 mb-4">
        <History className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No alert history yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        When alerts are triggered, they will appear here with their status and details.
        Activate some alerts to start monitoring your application.
      </p>
    </div>
  );
}

// Error state component
function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-4">
        <AlertTriangle className="size-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">Failed to load history</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {message || "An error occurred while loading alert history. Please try again."}
      </p>
    </div>
  );
}

export default function AlertHistoryList({ orgSlug, projectSlug }: AlertHistoryListProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AlertEventStatus | "all">("all");

  const offset = page * ITEMS_PER_PAGE;

  // Build query params
  const queryParams = new URLSearchParams({
    offset: String(offset),
    limit: String(ITEMS_PER_PAGE),
  });
  if (statusFilter !== "all") {
    queryParams.set("status", statusFilter);
  }

  // Fetch alert history
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.alertHistory(projectSlug), statusFilter, page],
    queryFn: async () => {
      const res = await apiFetch<DataEnvelope<AlertHistoryResponse>>(
        `/api/orgs/${orgSlug}/projects/${projectSlug}/alerts/history?${queryParams.toString()}`
      );
      return res.data;
    },
    staleTime: 30_000,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Handle page navigation
  const goToPrevPage = () => setPage((p) => Math.max(0, p - 1));
  const goToNextPage = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  // Handle filter change
  const handleFilterChange = (filter: AlertEventStatus | "all") => {
    setStatusFilter(filter);
    setPage(0); // Reset to first page on filter change
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Filter:</span>
        <FilterButton
          label="All"
          active={statusFilter === "all"}
          onClick={() => handleFilterChange("all")}
        />
        <FilterButton
          label="Active"
          active={statusFilter === "active"}
          onClick={() => handleFilterChange("active")}
        />
        <FilterButton
          label="Resolved"
          active={statusFilter === "resolved"}
          onClick={() => handleFilterChange("resolved")}
        />
        <FilterButton
          label="Acknowledged"
          active={statusFilter === "acknowledged"}
          onClick={() => handleFilterChange("acknowledged")}
        />
      </div>

      {/* History list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="w-5" /> {/* Severity icon */}
          <div className="flex-1">Alert</div>
          <div className="w-36">Triggered</div>
          <div className="w-36">Resolved</div>
          <div className="w-20 text-right">Value</div>
          <div className="w-20 text-right">Threshold</div>
          <div className="w-24 text-right">Status</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <HistoryRowSkeleton key={i} />
            ))}
          </>
        )}

        {/* Error state */}
        {error && !isLoading && <ErrorState />}

        {/* Empty state */}
        {!isLoading && !error && events.length === 0 && <EmptyState />}

        {/* Event rows */}
        {!isLoading && !error && events.length > 0 && (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <AlertHistoryRow
                key={event.id}
                event={event}
                orgSlug={orgSlug}
                projectSlug={projectSlug}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !error && total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + ITEMS_PER_PAGE, total)} of {total} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={page === 0}
              className="p-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
