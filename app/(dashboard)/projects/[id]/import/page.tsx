import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/components/import/upload-zone";
import { ImportLogList } from "@/components/import/import-log-list";

interface Props {
  params: { id: string };
}

export default async function ImportPage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, project_number")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (!project) redirect("/");

  const { data: logs } = await supabase
    .from("import_logs")
    .select("*")
    .eq("project_id", params.id)
    .order("imported_at", { ascending: false })
    .limit(5);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {project.project_number ?? project.id}
        </p>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-1">Import data</p>
      </div>

      {/* Upload zones */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jira Export</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadZone
              source="jira"
              projectId={params.id}
              label="Upload Jira Excel export"
              description="Issues and sprint data"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenAir Export</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadZone
              source="openair"
              projectId={params.id}
              label="Upload OpenAir Excel export"
              description="Timesheets, budget and milestones"
            />
          </CardContent>
        </Card>
      </div>

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportLogList logs={logs ?? []} />
        </CardContent>
      </Card>
    </main>
  );
}
