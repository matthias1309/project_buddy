"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  updateThresholds,
  resetThresholds,
  type ThresholdActionState,
} from "@/lib/actions/threshold.actions";
import type { ThresholdsInput } from "@/lib/validations/thresholds.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ThresholdsFormProps {
  projectId: string;
  initialValues: ThresholdsInput;
}

interface ThresholdFieldProps {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  error?: string;
  unit?: string;
}

function ThresholdField({
  id,
  name,
  label,
  hint,
  defaultValue,
  error,
  unit = "%",
}: ThresholdFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={name}
          type="number"
          min={0}
          step={unit === "%" ? 1 : 1}
          defaultValue={defaultValue}
          className="w-28"
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save thresholds"}
    </Button>
  );
}

export function ThresholdsForm({
  projectId,
  initialValues,
}: ThresholdsFormProps) {
  const router = useRouter();
  const boundUpdate = updateThresholds.bind(null, projectId);
  const [state, formAction] = useFormState<ThresholdActionState, FormData>(
    boundUpdate,
    null,
  );

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPendingReset, startResetTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state?.success, router]);

  function handleReset() {
    setResetError(null);
    startResetTransition(async () => {
      const result = await resetThresholds(projectId);
      if (result.success) {
        setShowResetDialog(false);
        router.refresh();
      } else {
        setResetError(result.globalError ?? "An error occurred.");
      }
    });
  }

  const e = state?.errors ?? {};

  return (
    <>
      {state?.success && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Thresholds saved successfully.
        </div>
      )}

      {state?.globalError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.globalError}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ThresholdField
              id="budget_yellow_pct"
              name="budget_yellow_pct"
              label="Yellow threshold"
              hint="Budget deviation at which the indicator turns yellow"
              defaultValue={initialValues.budget_yellow_pct}
              error={e.budget_yellow_pct}
            />
            <ThresholdField
              id="budget_red_pct"
              name="budget_red_pct"
              label="Red threshold"
              hint="Budget deviation at which the indicator turns red (must be > yellow)"
              defaultValue={initialValues.budget_red_pct}
              error={e.budget_red_pct}
            />
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ThresholdField
              id="schedule_yellow_days"
              name="schedule_yellow_days"
              label="Yellow threshold"
              hint="Milestone delay in days at which the indicator turns yellow"
              defaultValue={initialValues.schedule_yellow_days}
              error={e.schedule_yellow_days}
              unit="days"
            />
            <ThresholdField
              id="schedule_red_days"
              name="schedule_red_days"
              label="Red threshold"
              hint="Milestone delay in days at which the indicator turns red (must be > yellow)"
              defaultValue={initialValues.schedule_red_days}
              error={e.schedule_red_days}
              unit="days"
            />
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ThresholdField
              id="resource_yellow_pct"
              name="resource_yellow_pct"
              label="Yellow threshold"
              hint="Overall utilisation % at which the indicator turns yellow"
              defaultValue={initialValues.resource_yellow_pct}
              error={e.resource_yellow_pct}
            />
            <ThresholdField
              id="resource_red_pct"
              name="resource_red_pct"
              label="Red threshold"
              hint="Overall utilisation % at which the indicator turns red (must be > yellow)"
              defaultValue={initialValues.resource_red_pct}
              error={e.resource_red_pct}
            />
          </CardContent>
        </Card>

        {/* Scope */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ThresholdField
              id="scope_yellow_pct"
              name="scope_yellow_pct"
              label="Yellow threshold"
              hint="Scope growth % at which the indicator turns yellow"
              defaultValue={initialValues.scope_yellow_pct}
              error={e.scope_yellow_pct}
            />
            <ThresholdField
              id="scope_red_pct"
              name="scope_red_pct"
              label="Red threshold"
              hint="Scope growth % at which the indicator turns red (must be > yellow)"
              defaultValue={initialValues.scope_red_pct}
              error={e.scope_red_pct}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <SaveButton />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowResetDialog(true)}
          >
            Reset to defaults
          </Button>
        </div>
      </form>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to default thresholds?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will restore all threshold values to their defaults (15% / 25%
            budget; 5 / 15 days; 85% / 100% utilisation; 10% / 20% scope) and
            overwrite your current settings.
          </p>
          {resetError && (
            <p className="text-sm text-destructive">{resetError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isPendingReset}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isPendingReset}
            >
              {isPendingReset ? "Resetting…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
