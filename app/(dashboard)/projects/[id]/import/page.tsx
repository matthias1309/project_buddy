export default function ImportPage({ params }: { params: { id: string } }) {
  return (
    <main className="p-8">
      <p className="text-muted-foreground">
        Import — project {params.id} — Phase 3
      </p>
    </main>
  );
}
