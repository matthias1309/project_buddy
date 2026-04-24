import type { StabilityStatus } from "@/types/domain.types";

export type { StabilityStatus };

interface StabilityBadgeProps {
  status: StabilityStatus;
}

const config: Record<
  StabilityStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  green: {
    label: "Stable",
    badgeClass:
      "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
    dotClass: "bg-green-500",
  },
  yellow: {
    label: "At Risk",
    badgeClass:
      "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20",
    dotClass: "bg-yellow-500",
  },
  red: {
    label: "Critical",
    badgeClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
    dotClass: "bg-red-500",
  },
  none: {
    label: "No Data",
    badgeClass: "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-400/20",
    dotClass: "bg-gray-400",
  },
};

export function StabilityBadge({ status }: StabilityBadgeProps) {
  const { label, badgeClass, dotClass } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
