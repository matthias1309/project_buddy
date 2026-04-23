# MVP-Implementierungsplan: PM-Dashboard

Dieser Plan ist in sequenzielle Phasen aufgeteilt. Jede Phase enthält den **Claude Code Prompt**, der direkt verwendet werden kann. Phasen bauen aufeinander auf – keine Phase überspringen.

---

## Phase 0: Projektinitialisierung

### Schritt 0.1 – Next.js Projekt & Stack aufsetzen

```
Erstelle ein neues Next.js 14 Projekt mit App Router für ein internes PM-Dashboard Tool.

Stack:
- Next.js 14 mit App Router und TypeScript
- Tailwind CSS
- shadcn/ui (initialisiere mit `npx shadcn-ui@latest init`)
- Supabase (installiere @supabase/supabase-js und @supabase/ssr)
- Recharts für Diagramme
- xlsx (SheetJS) für Excel-Parsing
- Zod für Validierung
- Vitest für Tests

Erstelle folgende Verzeichnisstruktur:
/app/(auth)/login
/app/(dashboard)/layout.tsx
/app/(dashboard)/page.tsx
/app/(dashboard)/projects/[id]/page.tsx
/app/(dashboard)/projects/[id]/import/page.tsx
/app/(dashboard)/projects/[id]/settings/page.tsx
/components/ui (shadcn)
/components/dashboard
/components/import
/components/shared
/lib/supabase (server.ts, client.ts)
/lib/parsers (jira-parser.ts, openair-parser.ts)
/lib/calculations (stability-index.ts, kpi-calculations.ts)
/lib/validations
/lib/errors.ts
/types/domain.types.ts
/supabase/migrations
/tests/fixtures
/docs/arc42

Installiere außerdem: @types/node, eslint-config-next

Erstelle eine .env.local.example mit:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

Erstelle eine vitest.config.ts für das Testsetup.

CLAUDE.md liegt im Projektroot und definiert alle Konventionen – halte dich strikt daran.
```

---

### Schritt 0.2 – Supabase Schema & Migrations

```
Erstelle die initiale Supabase-Migration in /supabase/migrations/20240101_001_initial_schema.sql

Das Schema umfasst folgende Tabellen (alle mit RLS aktiviert):

1. projects
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - owner_id uuid REFERENCES auth.users NOT NULL
   - name text NOT NULL
   - project_number text
   - description text
   - client text
   - start_date date NOT NULL
   - end_date date NOT NULL
   - total_budget_eur numeric(12,2) NOT NULL
   - created_at timestamptz DEFAULT now()
   - updated_at timestamptz DEFAULT now()

2. import_logs
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - source text NOT NULL CHECK (source IN ('jira', 'openair'))
   - filename text NOT NULL
   - status text NOT NULL CHECK (status IN ('success', 'error', 'partial'))
   - records_imported integer
   - error_message text
   - imported_at timestamptz DEFAULT now()

3. jira_issues
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - issue_key text NOT NULL
   - summary text
   - issue_type text
   - status text
   - story_points numeric
   - sprint text
   - epic text
   - assignee text
   - created_date date
   - resolved_date date
   - import_log_id uuid REFERENCES import_logs

4. jira_sprints
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - sprint_name text NOT NULL
   - state text
   - start_date date
   - end_date date
   - completed_points numeric
   - planned_points numeric
   - import_log_id uuid REFERENCES import_logs

5. oa_timesheets
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - employee_name text
   - role text
   - phase text
   - planned_hours numeric
   - booked_hours numeric
   - period_date date
   - import_log_id uuid REFERENCES import_logs

6. oa_milestones
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - name text NOT NULL
   - planned_date date
   - actual_date date
   - status text
   - import_log_id uuid REFERENCES import_logs

7. oa_budget_entries
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE
   - category text
   - planned_eur numeric(12,2)
   - actual_eur numeric(12,2)
   - period_date date
   - import_log_id uuid REFERENCES import_logs

8. project_thresholds
   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   - project_id uuid REFERENCES projects ON DELETE CASCADE UNIQUE
   - budget_yellow_pct numeric DEFAULT 15
   - budget_red_pct numeric DEFAULT 25
   - schedule_yellow_days integer DEFAULT 5
   - schedule_red_days integer DEFAULT 15
   - resource_yellow_pct numeric DEFAULT 85
   - resource_red_pct numeric DEFAULT 100
   - scope_yellow_pct numeric DEFAULT 10
   - scope_red_pct numeric DEFAULT 20

RLS-Policies:
- Alle Tabellen: SELECT/INSERT/UPDATE/DELETE nur wenn auth.uid() = project.owner_id
  (projects direkt, alle anderen über JOIN auf projects)
- Nutze Supabase RLS-Best-Practices

Erstelle außerdem einen Trigger für updated_at auf allen Tabellen die es haben.

Erstelle /types/database.types.ts mit den TypeScript-Typen (als würde Supabase CLI sie generieren).
```

---

## Phase 1: Authentifizierung

### Schritt 1.1 – Login-Seite & Auth-Guard

```
Implementiere die Authentifizierung für das PM-Dashboard gemäß FEAT-001 in CLAUDE.md.

Erstelle:

1. /lib/supabase/server.ts – Supabase Server Client (SSR-kompatibel mit @supabase/ssr)
2. /lib/supabase/client.ts – Supabase Browser Client
3. /middleware.ts – Auth-Guard: Redirect auf /login wenn nicht eingeloggt, außer für /login selbst

4. /app/(auth)/login/page.tsx – Login-Seite:
   - shadcn/ui Card, Input, Button, Label Komponenten
   - E-Mail und Passwort Felder
   - Fehlermeldung bei falschen Credentials (generisch: "E-Mail oder Passwort falsch")
   - Server Action für Login (kein Client-seitiger Supabase-Call)
   - Nach erfolgreichem Login: Redirect auf /

5. /app/(dashboard)/layout.tsx:
   - Prüft Auth-Session (Server Component)
   - Navigation mit: Logo, "Projekte" Link, User-E-Mail, Logout-Button
   - Logout als Server Action

Alle Komponenten in TypeScript ohne any.
Teste die Login-Logik: /tests/auth.test.ts (mock Supabase Client)
```

---

## Phase 2: Projektverwaltung

### Schritt 2.1 – Projektübersicht (Hülle)

```
Implementiere die Projektübersicht gemäß FEAT-002 in CLAUDE.md.

/app/(dashboard)/page.tsx:
- Lädt alle Projekte des eingeloggten Nutzers aus Supabase (Server Component)
- Zeigt eine Karten-Liste (shadcn Card) mit:
  - Projektname und Projektnummer
  - Stabilitätsampel (Placeholder: immer "grün" – wird in Phase 5 befüllt)
  - Letztes Import-Datum (aus import_logs, neuester Eintrag)
  - Klick führt zu /projects/[id]
- Leerzustand: "Noch keine Projekte – Erstes Projekt anlegen" mit Button
- Button "Neues Projekt anlegen" oben rechts → öffnet Dialog

/components/dashboard/project-card.tsx – Wiederverwendbare Projektkarte
/components/shared/stability-badge.tsx – Ampel-Komponente (Props: status: 'green'|'yellow'|'red')
```

### Schritt 2.2 – Projekt anlegen

```
Implementiere FEAT-003: Projekt anlegen.

/components/dashboard/create-project-dialog.tsx:
- shadcn Dialog mit Formular
- Felder: Name (required), Projektnummer (required), Startdatum, Enddatum, Gesamtbudget €, Beschreibung, Kunde
- Zod-Validierungsschema in /lib/validations/project.schema.ts
- Server Action in /lib/actions/project.actions.ts:
  - createProject(formData): Validierung → Supabase INSERT → project_thresholds mit Defaults anlegen → return { data, error }
- Nach Erfolg: Router.push zu /projects/[newId]/import
- Fehlermeldungen inline unter den Feldern

Erstelle /tests/validations/project.schema.test.ts mit Tests für das Zod-Schema.
```

---

## Phase 3: Excel-Import

### Schritt 3.1 – Jira Parser

```
Implementiere den Jira Excel-Parser gemäß FEAT-004 in CLAUDE.md.

/lib/parsers/jira-parser.ts:

Exportiere:
- parseJiraExcel(buffer: Buffer): JiraParseResult

Typen in /types/domain.types.ts:
- JiraIssue { issueKey, summary, issueType, status, storyPoints?, sprint?, epic?, assignee?, createdDate?, resolvedDate? }
- JiraSprint { sprintName, state?, startDate?, endDate?, completedPoints?, plannedPoints? }
- JiraParseResult { issues: JiraIssue[], sprints: JiraSprint[], errors: ParseError[], warnings: string[] }
- ParseError { row: number, message: string }

Parser-Logik:
- Spalten-Mapping (case-insensitive, flexibel):
  - "Issue Key" / "Key" → issueKey
  - "Summary" / "Zusammenfassung" → summary
  - "Issue Type" / "Vorgangstyp" → issueType
  - "Status" → status
  - "Story Points" / "Story point estimate" → storyPoints
  - "Sprint" → sprint
  - "Epic Link" / "Epic" → epic
  - "Assignee" / "Zugewiesene Person" → assignee
  - "Created" / "Erstellt" → createdDate
  - "Resolved" / "Gelöst" → resolvedDate
- Fehlende Pflichtfelder (issueKey, status) → ParseError mit Zeilennummer
- Unbekannte Spalten → ignorieren (keine Warnung)
- Leere Zeilen → überspringen

Erstelle /tests/parsers/jira-parser.test.ts:
- Test: valide Datei wird korrekt gemappt
- Test: unbekannte Spalten werden ignoriert
- Test: fehlender Issue Key → ParseError mit Zeilennummer
- Test: leere Zeilen werden übersprungen
- Test: deutsche Spaltennamen werden erkannt

Erstelle /tests/fixtures/jira-sample.xlsx mit synthetischen Testdaten (5 Issues, 2 Sprints).
```

### Schritt 3.2 – OpenAir Parser

```
Implementiere den OpenAir Excel-Parser gemäß FEAT-005 in CLAUDE.md.

/lib/parsers/openair-parser.ts:

Exportiere:
- parseOpenAirExcel(buffer: Buffer): OpenAirParseResult

Typen:
- OATimesheet { employeeName?, role?, phase?, plannedHours?, bookedHours?, periodDate? }
- OAMilestone { name, plannedDate?, actualDate?, status? }
- OABudgetEntry { category?, plannedEur?, actualEur?, periodDate? }
- OpenAirParseResult { timesheets: OATimesheet[], milestones: OAMilestone[], budgetEntries: OABudgetEntry[], errors: ParseError[], warnings: string[] }

Parser-Logik:
- OpenAir exportiert oft mehrere "Blöcke" auf einem Sheet – erkenne Blöcke anhand von Header-Zeilen
- Spalten-Mapping für Timesheets:
  - "Mitarbeiter" / "Employee" → employeeName
  - "Rolle" / "Role" / "Job Code" → role
  - "Phase" / "Task" → phase
  - "Geplante Stunden" / "Planned Hours" / "Budget Hours" → plannedHours
  - "Gebuchte Stunden" / "Actual Hours" / "Hours" → bookedHours
  - "Datum" / "Date" / "Period" → periodDate
- Fehlende Budget-Felder → Warnung (kein harter Fehler)
- Negative Stunden → Warnung

Erstelle Tests analog zu Jira-Parser.
Erstelle /tests/fixtures/openair-sample.xlsx mit synthetischen Daten.
```

### Schritt 3.3 – Import API Route & UI

```
Implementiere die Import-UI und API-Route gemäß FEAT-004 und FEAT-005.

/app/api/projects/[id]/import/route.ts (POST):
- Authentifizierung prüfen (Supabase Server Client)
- Prüfen ob Nutzer Zugriff auf project_id hat
- Multipart Form: file (Excel), source ('jira' | 'openair')
- Dateigröße-Check: max 10 MB
- Buffer an Parser übergeben
- Bei Jira:
  1. Alle bestehenden jira_issues und jira_sprints des Projekts löschen
  2. Neue Daten in Batch einfügen (max 500 Rows pro Insert)
  3. import_log Eintrag erstellen
- Bei OpenAir: analog
- Response: { success, recordsImported, errors, warnings, importLogId }

/app/(dashboard)/projects/[id]/import/page.tsx:
- Zwei Upload-Bereiche: "Jira Export" und "OpenAir Export"
- Drag & Drop + Datei-Dialog (shadcn oder eigene Komponente)
- Upload-Status: Idle → Uploading → Success / Error
- Erfolgsmeldung mit Anzahl importierter Datensätze
- Fehlerliste bei Parse-Errors (Zeilennummern)
- Import-Historie: letzte 5 Importe aus import_logs

/components/import/upload-zone.tsx – Wiederverwendbare Upload-Komponente
/components/import/import-log-list.tsx – Import-Verlauf

Erstelle /tests/api/import.test.ts für die API Route (mocke Supabase und Parser).
```

---

## Phase 4: KPI-Berechnungen & Ampellogik

### Schritt 4.1 – KPI-Berechnungen

```
Implementiere alle KPI-Berechnungsfunktionen in /lib/calculations/kpi-calculations.ts.

Alle Funktionen sind pure functions (kein DB-Zugriff, nur Berechnungen auf Daten).

Exportiere:

// Budget
function calcBudgetKPIs(budgetEntries: OABudgetEntry[], totalBudget: number): BudgetKPIs
// Returns: { plannedEur, actualEur, differenceEur, differencePct, burnRate, eac }
// burnRate = actualEur / vergangene Tage * 30 (monatlich)
// EAC = actualEur + (totalBudget - plannedEur) // vereinfacht

// Zeitplan
function calcScheduleKPIs(milestones: OAMilestone[], today: Date): ScheduleKPIs
// Returns: { totalMilestones, delayedMilestones, maxDelayDays, nextMilestone }
// Delay = actualDate - plannedDate (wenn actualDate > plannedDate)
// Nächster Meilenstein = frühester zukünftiger mit status !== 'completed'

// Ressourcen
function calcResourceKPIs(timesheets: OATimesheet[]): ResourceKPIs
// Returns: { byRole: { role, plannedHours, bookedHours, utilizationPct }[], overallUtilizationPct }
// Aggregiere nach Rolle

// Scope
function calcScopeKPIs(issues: JiraIssue[], sprints: JiraSprint[]): ScopeKPIs
// Returns: { totalIssues, openIssues, totalStoryPoints, completedStoryPoints, completionPct, velocityTrend, bugRate }
// velocityTrend: letzte 3 Sprints completedPoints

Erstelle /types/domain.types.ts mit allen KPI-Typen (BudgetKPIs, ScheduleKPIs, etc.)

Erstelle /tests/calculations/kpi-calculations.test.ts:
- Mindestens 3 Tests pro Funktion
- Teste: Normalfall, Leer-Input, Boundary-Werte, negative Abweichungen
```

### Schritt 4.2 – Stabilitätsindex (Ampellogik)

```
Implementiere den Stabilitätsindex in /lib/calculations/stability-index.ts.

Exportiere:
type StabilityStatus = 'green' | 'yellow' | 'red'
type StabilityResult = { status: StabilityStatus, score: number, dimensions: DimensionResult[] }
type DimensionResult = { dimension: 'budget'|'schedule'|'resource'|'scope', status: StabilityStatus, value: number, threshold: { yellow: number, red: number } }

function calcStabilityIndex(
  kpis: { budget: BudgetKPIs, schedule: ScheduleKPIs, resource: ResourceKPIs, scope: ScopeKPIs },
  thresholds: ProjectThresholds
): StabilityResult

Regeln:
- Budget: differencePct > threshold.budget_red_pct → rot; > yellow → gelb
- Schedule: maxDelayDays > schedule_red_days → rot; > yellow → gelb
- Resource: overallUtilizationPct > resource_red_pct → rot; > yellow → gelb
- Scope: scope-Wachstum > scope_red_pct → rot (berechne vs. initial geplante Points)
- Gesamt-Status: wenn min 1 rot → rot; wenn min 1 gelb → gelb; sonst grün
- Score: 100 - (Anzahl Rot * 30 + Anzahl Gelb * 10) – minimum 0

Erstelle /tests/calculations/stability-index.test.ts:
- Test: alle grün → grün
- Test: ein rot → gesamt rot
- Test: boundary Werte (exakt auf Schwelle)
- Test: alle rot → Score 0 (oder Minimum)
- Test: Custom Thresholds werden korrekt angewendet
```

---

## Phase 5: Dashboard

### Schritt 5.1 – Projektdetail-Dashboard

```
Implementiere das Projektdetail-Dashboard gemäß FEAT-006.

/app/(dashboard)/projects/[id]/page.tsx (Server Component):
- Lädt aus Supabase: Projektdaten, alle jira_issues, jira_sprints, oa_timesheets, oa_milestones, oa_budget_entries, project_thresholds
- Berechnet KPIs und Stabilitätsindex (server-seitig)
- Wenn keine Import-Daten vorhanden: zeige Hinweis-Komponente mit Link zum Import

Layout:
- Header: Projektname, Projektnummer, Gesamtstabilitätsampel (groß)
- 4 Kacheln in 2×2 Grid (shadcn Card):

/components/dashboard/budget-card.tsx:
- Ist €, Plan €, Differenz € (farbig: rot wenn negativ), Burn Rate €/Monat
- Fortschrittsbalken: Ist vs. Plan

/components/dashboard/schedule-card.tsx:
- Nächster Meilenstein mit Datum
- Liste verzögerter Meilensteine (max 3, mit Verzug in Tagen)
- Kleines Balkendiagramm: Meilensteine nach Status (geplant/fertig/verzögert)

/components/dashboard/resource-card.tsx:
- Balkendiagramm (Recharts HorizontalBar): Auslastung % je Rolle
- Referenzlinie bei 100%
- Legende: unter 85% grün, 85-100% gelb, über 100% rot

/components/dashboard/scope-card.tsx:
- Story Points: abgeschlossen vs. gesamt (Fortschrittsbalken)
- Bug-Rate %
- Velocity der letzten 3 Sprints (Recharts LineChart, mini)

Alle Charts sind responsiv (Recharts ResponsiveContainer).
Keine Loading-States nötig (Server Component lädt alles vorab).
```

### Schritt 5.2 – Projektübersicht mit echten Daten

```
Aktualisiere die Projektübersicht /app/(dashboard)/page.tsx:

- Berechne den Stabilitätsindex für jedes Projekt server-seitig
- Übergebe echten Status an stability-badge.tsx
- Zeige zusätzlich zur Ampel: 
  - Kritischste Dimension (welche ist rot/gelb)
  - Kurzinfo: Budget-Differenz % oder Verzug in Tagen (je nachdem was kritischster Indikator)

Falls ein Projekt noch keine Daten hat → Ampel grau mit Text "Kein Import"
```

---

## Phase 6: Schwellenwert-Konfiguration

### Schritt 6.1 – Settings-Seite

```
Implementiere FEAT-007: Schwellenwert-Konfiguration.

/app/(dashboard)/projects/[id]/settings/page.tsx:
- Lädt project_thresholds aus Supabase
- Formular mit den 8 Schwellenwerten (shadcn Input, Label)
- Gruppiert in vier Abschnitte: Budget, Zeitplan, Ressourcen, Scope
- Jeder Abschnitt: gelber Schwelle, roter Schwelle + Erklärungstext was der Wert bedeutet
- Zod-Validierung: red > yellow (roter Schwellenwert muss strenger sein)
- Server Action: updateThresholds(projectId, data)
- Nach Speichern: Erfolgsmeldung via shadcn Toast
- Reset-Button: setzt auf Default-Werte zurück (mit Bestätigungs-Dialog)

/lib/validations/thresholds.schema.ts:
- Zod-Schema mit Refinement: budget_red_pct > budget_yellow_pct etc.

/lib/actions/threshold.actions.ts:
- updateThresholds(projectId, data): validieren → upsert → return { data, error }

Erstelle /tests/validations/thresholds.schema.test.ts.
```

---

## Phase 7: Qualitätssicherung & Dokumentation

### Schritt 7.1 – arc42 Dokumentation

```
Erstelle die arc42-Architekturdokumentation für den MVP-Stand.

Erstelle folgende Dateien in /docs/arc42/:

01_introduction.md:
- Fachliche Anforderungen (aus PROJECT_CONTEXT.md)
- Qualitätsziele: Performance (<2s), Korrektheit der KPIs, Erweiterbarkeit für Rollen

02_constraints.md:
- Technisch: Next.js 14, Supabase, Intranet-Deployment
- Organisatorisch: manueller Excel-Import im MVP, max 5 Projekte

03_context.md:
- Kontextdiagramm (als Mermaid): PM-Dashboard ↔ Projektleiter, Jira (Export), OpenAir (Export), Supabase
- Externe Systeme und deren Schnittstellen

04_solution_strategy.md:
- Entscheidung für Server Components als primäres Datenlademuster
- Supabase RLS als Sicherheitsstrategie
- Pure Functions für Berechnungen (Testbarkeit)

05_building_blocks.md:
- Ebene 1: Frontend (Next.js) / Datenhaltung (Supabase) / Import-Pipeline
- Ebene 2: Unterkomponenten je Baustein

06_runtime.md:
- Sequenzdiagramm (Mermaid): Import-Flow (User → Upload → Parser → Supabase)
- Sequenzdiagramm: Dashboard-Laden (Request → DB-Query → KPI-Berechnung → Render)

09_decisions/:
- ADR-001 bis ADR-004 (aus CLAUDE.md)

10_quality.md:
- Qualitätsszenarien für Performance, Korrektheit, Erweiterbarkeit

Alle Diagramme als Mermaid-Code-Blöcke.
```

### Schritt 7.2 – Abschluss-Check

```
Führe folgende Abschluss-Prüfungen durch und behebe gefundene Probleme:

1. TypeScript: `npx tsc --noEmit` – alle Fehler beheben
2. Tests: `npx vitest run` – alle Tests müssen grün sein
3. Lint: `npx next lint` – keine Errors

Prüfe außerdem:
- Alle Tabellen haben RLS-Policies
- Kein `any` im TypeScript-Code
- Keine hardcodierten Strings für Fehlermeldungen (alles in /lib/errors.ts)
- Alle Server Actions geben { data, error } zurück
- Import-Zähler: FEAT-004 AC "Anzahl importierter Issues angezeigt" ✓
- Leerzustand Dashboard (kein Import) zeigt Hinweis ✓

Erstelle abschließend eine CHANGELOG.md mit allen implementierten Features (FEAT-001 bis FEAT-007).
```

---

## Abhängigkeitsgraph

```
Phase 0 (Setup)
    └── Phase 1 (Auth)
            └── Phase 2 (Projektverwaltung)
                    └── Phase 3 (Import)
                            └── Phase 4 (Berechnungen)
                                    └── Phase 5 (Dashboard)
                                            └── Phase 6 (Settings)
                                                    └── Phase 7 (Doku & QS)
                                                            └── Phase 8 (Docker)
```

## Zeitschätzung (Claude Code Sessions)

| Phase | Komplexität | Geschätzte Sessions |
|---|---|---|
| 0 – Setup | Mittel | 2 |
| 1 – Auth | Gering | 1 |
| 2 – Projektverwaltung | Gering | 2 |
| 3 – Import | Hoch | 4 |
| 4 – Berechnungen | Hoch | 3 |
| 5 – Dashboard | Mittel | 3 |
| 6 – Settings | Gering | 1 |
| 7 – Doku & QS | Mittel | 2 |
| 8 – Docker & Deployment | Gering | 2 |
| **Gesamt** | | **~20 Sessions** |

---

## Phase 8: Docker & Deployment

### Schritt 8.1 – Dockerfile & docker-compose

```
Erstelle ein produktionsreifes Docker-Setup für das Next.js PM-Dashboard.

next.config.ts anpassen:
- `output: 'standalone'` (pflicht für minimales Docker-Image)
- `experimental: { serverComponentsExternalPackages: ['xlsx'] }` (xlsx benötigt nativen Node-Zugriff)

Dockerfile (Multi-Stage Build):

Stage 1 "deps" – node:20-alpine:
  COPY package*.json .
  RUN npm ci --only=production

Stage 2 "builder" – node:20-alpine:
  ENV NEXT_TELEMETRY_DISABLED=1
  COPY --from=deps /app/node_modules .
  COPY . .
  RUN npm run build

Stage 3 "runner" – node:20-alpine:
  ENV NODE_ENV=production
  ENV NEXT_TELEMETRY_DISABLED=1
  RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  USER nextjs
  EXPOSE 3000
  ENV PORT=3000
  ENV HOSTNAME="0.0.0.0"
  CMD ["node", "server.js"]

docker-compose.yml (Intranet-Deployment):
  version: '3.8'
  services:
    app:
      build: .
      ports: ["3000:3000"]
      env_file: .env.production
      restart: unless-stopped
      healthcheck:
        test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
        interval: 30s
        timeout: 10s
        retries: 3

Hinweis: Supabase läuft extern (Supabase Cloud oder Supabase Self-Hosted separat).
Für Supabase Self-Hosted im Intranet: eigene docker-compose.supabase.yml nach
https://supabase.com/docs/guides/self-hosting/docker

/app/api/health/route.ts erstellen:
  GET → return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  (wird vom Docker-Healthcheck genutzt)

.dockerignore:
  node_modules
  .next
  .env*
  tests/
  docs/
  *.md
  .git

.env.production.example:
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NODE_ENV=production

README.md ergänzen mit Deployment-Abschnitt:
  docker build -t pm-dashboard .
  docker run -p 3000:3000 --env-file .env.production pm-dashboard
  # oder
  docker-compose up -d

Abschließend prüfen: `docker build -t pm-dashboard-test .` muss ohne Fehler durchlaufen.
```

### Schritt 8.2 – Fixture-Generator für Tests

```
Erstelle /tests/fixtures/generate-fixtures.ts:

Dieses Skript generiert alle synthetischen Test-Excel-Dateien mit SheetJS (xlsx).
Es wird NICHT im Docker-Image ausgeliefert, nur für lokale Entwicklung.

Generiere folgende Dateien:

1. jira-sample.xlsx
   Sheet "Issues": Spalten Issue Key, Summary, Issue Type, Status, Story Points, Sprint, Epic Link, Assignee, Created, Resolved
   5 Issues (Mix aus Story/Bug/Task, Status: To Do/In Progress/Done)
   Sheet "Sprints": Sprint Name, State, Start Date, End Date, Completed Points, Planned Points (2 Sprints)

2. jira-german-columns.xlsx
   Gleiche Daten, aber Spaltennames: Vorgangsschlüssel, Zusammenfassung, Vorgangstyp, Status, Story Points, Sprint, Epic-Link, Zugewiesene Person, Erstellt, Gelöst

3. jira-missing-key.xlsx
   Wie jira-sample.xlsx, aber Zeile 3 hat keinen Issue Key (leere Zelle)

4. openair-sample.xlsx
   Sheet "Timesheets": Mitarbeiter, Rolle, Phase, Geplante Stunden, Gebuchte Stunden, Datum
   8 Einträge, 3 Rollen (Senior Consultant, Consultant, Projektleiter), 2 Phasen
   Sheet "Budget": Kategorie, Geplant (EUR), Ist (EUR), Periode
   4 Einträge (Personal, Reise, Lizenzen, Sonstiges)
   Sheet "Meilensteine": Name, Geplant, Aktuell, Status
   3 Meilensteine (1 erledigt, 1 pünktlich, 1 verzögert)

5. openair-partial.xlsx
   Wie openair-sample.xlsx, aber Budget-Sheet fehlt komplett

Nach Generierung alle Dateien nach /tests/fixtures/ schreiben.

Füge zu package.json hinzu:
  "scripts": {
    "fixtures:generate": "npx tsx tests/fixtures/generate-fixtures.ts"
  }

Führe das Skript direkt aus und committe die generierten .xlsx-Dateien.
```
