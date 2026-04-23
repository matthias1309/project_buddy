import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  const projectList = projects ?? [];

  const latestImportByProject: Record<string, string> = {};
  if (projectList.length > 0) {
    const { data: importLogs } = await supabase
      .from("import_logs")
      .select("project_id, imported_at")
      .in(
        "project_id",
        projectList.map((p) => p.id)
      )
      .order("imported_at", { ascending: false });

    for (const log of importLogs ?? []) {
      if (!latestImportByProject[log.project_id]) {
        latestImportByProject[log.project_id] = log.imported_at;
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <CreateProjectDialog />
      </div>

      {projectList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-lg font-medium">No projects yet</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your first project to get started.
          </p>
          <CreateProjectDialog label="Create First Project" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              lastImportedAt={latestImportByProject[project.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
