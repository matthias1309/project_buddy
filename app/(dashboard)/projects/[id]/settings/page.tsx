export default function SettingsPage({ params }: { params: { id: string } }) {
  return (
    <main className="p-8">
      <p className="text-muted-foreground">
        Settings — project {params.id} — Phase 6
      </p>
    </main>
  );
}
