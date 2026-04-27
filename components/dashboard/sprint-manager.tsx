"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createSprint,
  updateSprint,
  deleteSprint,
  type SprintActionState,
} from "@/lib/actions/sprint.actions";
import { ERRORS } from "@/lib/errors";
import type { ProjectSprint } from "@/types/domain.types";
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

interface SprintManagerProps {
  projectId: string;
  initialSprints: ProjectSprint[];
}

interface SprintFormProps {
  projectId:   string;
  sprint?:     ProjectSprint;
  onSuccess:   () => void;
  onCancel:    () => void;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function SprintForm({ projectId, sprint, onSuccess, onCancel }: SprintFormProps) {
  const isEdit = !!sprint;

  const boundAction = isEdit
    ? updateSprint.bind(null, projectId, sprint!.id)
    : createSprint.bind(null, projectId);

  const [state, formAction] = useFormState<SprintActionState, FormData>(
    boundAction,
    null,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const e = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state?.globalError && (
        <p role="alert" className="text-sm text-destructive">{state.globalError}</p>
      )}

      <div className="space-y-1">
        <Label htmlFor="sprint-name">Name</Label>
        <Input
          id="sprint-name"
          name="name"
          defaultValue={sprint?.name ?? ""}
          placeholder="e.g. CPI26.2.1 CW13/14 Oolong"
          aria-describedby={e.name ? "sprint-name-error" : undefined}
        />
        {e.name && (
          <p id="sprint-name-error" className="text-sm text-destructive">{e.name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Must match the sprint name exactly as it appears in the Jira export.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="sprint-start">Start date</Label>
          <Input
            id="sprint-start"
            name="start_date"
            type="date"
            defaultValue={sprint?.start_date ?? ""}
            aria-describedby={e.start_date ? "sprint-start-error" : undefined}
          />
          {e.start_date && (
            <p id="sprint-start-error" className="text-sm text-destructive">{e.start_date}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="sprint-end">End date</Label>
          <Input
            id="sprint-end"
            name="end_date"
            type="date"
            defaultValue={sprint?.end_date ?? ""}
            aria-describedby={e.end_date ? "sprint-end-error" : undefined}
          />
          {e.end_date && (
            <p id="sprint-end-error" className="text-sm text-destructive">{e.end_date}</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton label={isEdit ? "Save changes" : "Add sprint"} />
      </DialogFooter>
    </form>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SprintManager({ projectId, initialSprints }: SprintManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<ProjectSprint | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ProjectSprint | undefined>();
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [isPendingDelete, startDelete]  = useTransition();

  function openAdd() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(sprint: ProjectSprint) {
    setEditTarget(sprint);
    setDialogOpen(true);
  }

  function handleFormSuccess() {
    setDialogOpen(false);
    router.refresh();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteSprint(projectId, deleteTarget.id);
      if (result.success) {
        setDeleteTarget(undefined);
        router.refresh();
      } else {
        setDeleteError(result.globalError ?? ERRORS.GENERIC);
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Sprints</CardTitle>
          <Button size="sm" onClick={openAdd}>Add sprint</Button>
        </CardHeader>
        <CardContent>
          {initialSprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sprints configured. Add a sprint to enable sprint-based filtering.
            </p>
          ) : (
            <ul className="divide-y">
              {initialSprints.map((sprint) => (
                <li key={sprint.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{sprint.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(sprint)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(sprint)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit sprint" : "Add sprint"}
            </DialogTitle>
          </DialogHeader>
          <SprintForm
            projectId={projectId}
            sprint={editTarget}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(undefined); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sprint?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{deleteTarget?.name}</span> will be permanently
            removed. This cannot be undone.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(undefined)}
              disabled={isPendingDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPendingDelete}
            >
              {isPendingDelete ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
