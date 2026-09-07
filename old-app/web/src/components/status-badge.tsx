import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-100 text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800",
  shortlisted:
    "bg-violet-100 text-violet-800 ring-1 ring-violet-200/80 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800",
  interview:
    "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
  rejected:
    "bg-red-100 text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800",
  hired:
    "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const label = key.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[key] ??
          "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
      )}
    >
      {label}
    </span>
  );
}
