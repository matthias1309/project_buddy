export default function ProjectDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="p-8">
      <p className="text-muted-foreground">
        Project dashboard {params.id} — Phase 5
      </p>
    </main>
  );
}
