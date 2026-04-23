"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createProject } from "@/lib/actions/project.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create Project"}
    </Button>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ id, label, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface CreateProjectDialogProps {
  label?: string;
}

export function CreateProjectDialog({
  label = "New Project",
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createProject, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) {
      formRef.current?.reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{label}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <Field
            id="name"
            label="Project Name"
            error={state?.errors?.name}
            required
          >
            <Input id="name" name="name" />
          </Field>

          <Field
            id="project_number"
            label="Project Number"
            error={state?.errors?.project_number}
            required
          >
            <Input id="project_number" name="project_number" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="start_date"
              label="Start Date"
              error={state?.errors?.start_date}
              required
            >
              <Input id="start_date" name="start_date" type="date" />
            </Field>

            <Field
              id="end_date"
              label="End Date"
              error={state?.errors?.end_date}
              required
            >
              <Input id="end_date" name="end_date" type="date" />
            </Field>
          </div>

          <Field
            id="total_budget_eur"
            label="Total Budget (€)"
            error={state?.errors?.total_budget_eur}
            required
          >
            <Input
              id="total_budget_eur"
              name="total_budget_eur"
              type="number"
              min="0.01"
              step="0.01"
            />
          </Field>

          <Field id="client" label="Customer" error={state?.errors?.client}>
            <Input id="client" name="client" />
          </Field>

          <Field
            id="description"
            label="Description"
            error={state?.errors?.description}
          >
            <Textarea id="description" name="description" rows={3} />
          </Field>

          {state?.globalError && (
            <p className="text-sm text-destructive">{state.globalError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
