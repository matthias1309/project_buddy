# CLAUDE.md — Development Rules for PM-Dashboard

This document defines binding rules for all code generation and changes in the project. Claude Code strictly adheres to these conventions.

---

## 0. Language

- **Project language: English** — all code, comments, variable names, function names, error messages, UI strings, documentation (arc42, ADRs), and file names are written in English.
- The conversation between the user and Claude Code happens in **German**.
- This CLAUDE.md file is maintained in **English**.

---

## 1. Stack & Abhängigkeiten

### Pflicht-Stack (nicht abweichen)
- **Next.js 14** mit App Router (`/app`-Verzeichnis, keine Pages-Router-Patterns)
- **TypeScript** – kein `any`, keine impliziten `any`
- **shadcn/ui** für alle UI-Komponenten (nicht neu erfinden, was shadcn bietet)
- **Tailwind CSS** für Styling (keine CSS-Module, keine styled-components)
- **Supabase** für DB, Auth und RLS
- **Recharts** für alle Diagramme
- **xlsx** (SheetJS) für Excel-Parsing (Server-seitig in API Routes)
- **Zod** für alle Validierungsschemas (Formulare, API-Responses, Excel-Mappings)

### Verbotene Patterns
- Kein `use client` ohne expliziten Grund (Server Components bevorzugen)
- Kein direkter DB-Zugriff im Client – immer über Server Actions oder API Routes
- Kein `console.log` in Production-Code (nur `console.error` mit strukturiertem Logging)
- Keine hardcodierten Strings für Fehlermeldungen (zentrale `errors.ts`)

---

## 2. Projektstruktur

```
/app
  /(auth)
    /login
  /(dashboard)
    /layout.tsx           ← Auth-Guard hier
    /page.tsx             ← Projekt-Übersicht
    /projects/[id]
      /page.tsx           ← Projekt-Dashboard
      /import
        /page.tsx         ← Import-UI
      /settings
        /page.tsx         ← Schwellenwerte
/components
  /ui                     ← shadcn-Komponenten (nicht editieren)
  /dashboard              ← Dashboard-spezifische Komponenten
  /import                 ← Import-Komponenten
  /shared                 ← Wiederverwendbare eigene Komponenten
/lib
  /supabase               ← Supabase-Client (server + client)
  /parsers
    /jira-parser.ts       ← Jira Excel → Internes Schema
    /openair-parser.ts    ← OpenAir Excel → Internes Schema
  /calculations
    /stability-index.ts   ← Ampellogik
    /kpi-calculations.ts  ← KPI-Berechnungen
  /validations            ← Zod-Schemas
  /errors.ts              ← Zentrale Fehlerdefinitionen
/types
  /database.types.ts      ← Supabase-generierte Types (nicht manuell editieren)
  /domain.types.ts        ← Business-Domänen-Types
/supabase
  /migrations             ← SQL-Migrationsdateien
  /seed.sql
```

---

## 3. Softwareanforderungen (als Akzeptanzkriterien)

Jedes Feature wird als User Story formuliert. Akzeptanzkriterien sind testbar.

### Format
```
## [FEAT-XXX] Titel

**Als** [Rolle]
**möchte ich** [Aktion]
**damit** [Nutzen]

### Akzeptanzkriterien
- [ ] AC1: ...
- [ ] AC2: ...

### Technische Hinweise
- ...
```

### Bestehende Anforderungen

#### FEAT-001: Login
**Als** Projektleiter **möchte ich** mich mit E-Mail und Passwort anmelden **damit** nur autorisierte Nutzer Zugriff haben.
- [ ] Login-Formular mit E-Mail und Passwort
- [ ] Fehlermeldung bei falschen Credentials (kein Hinweis ob E-Mail oder Passwort falsch)
- [ ] Redirect auf Projektübersicht nach Login
- [ ] Logout-Funktion in Navigation
- [ ] Session bleibt nach Browser-Neustart erhalten (Supabase-Standard)

#### FEAT-002: Projektübersicht
**Als** Projektleiter **möchte ich** alle meine Projekte auf einen Blick sehen **damit** ich sofort erkenne welche Projekte Aufmerksamkeit brauchen.
- [ ] Liste aller Projekte des eingeloggten Nutzers
- [ ] Stabilitätsampel (grün/gelb/rot) pro Projekt sichtbar
- [ ] Letzte Import-Datum sichtbar
- [ ] Klick auf Projekt öffnet Projektdetail-Dashboard
- [ ] Button "Neues Projekt anlegen"

#### FEAT-003: Projekt anlegen
**Als** Projektleiter **möchte ich** ein neues Projekt mit Stammdaten anlegen **damit** ich Importe einem Projekt zuordnen kann.
- [ ] Pflichtfelder: Name, Projektnummer, Start- und Enddatum, Gesamtbudget (€)
- [ ] Optionale Felder: Beschreibung, Kunde
- [ ] Validierung aller Pflichtfelder vor Speichern (Zod)
- [ ] Nach Anlage: Redirect auf Import-Seite des neuen Projekts

#### FEAT-004: Jira-Import
**Als** Projektleiter **möchte ich** eine Jira Excel-Exportdatei hochladen **damit** Delivery-Daten im Dashboard verfügbar sind.
- [ ] Dateiupload akzeptiert `.xlsx` und `.xls`
- [ ] Maximale Dateigröße: 10 MB (Fehlermeldung bei Überschreitung)
- [ ] Parser erkennt Standard-Jira-Spalten automatisch
- [ ] Unbekannte Spalten werden ignoriert (kein Fehler)
- [ ] Fehlende Pflichtfelder (Issue Key, Status) → Fehlermeldung mit Zeilennummer
- [ ] Erfolgreicher Import: Anzahl importierter Issues angezeigt
- [ ] Import-Log-Eintrag wird erstellt (Datum, Dateiname, Status, Anzahl)
- [ ] Erneuter Import überschreibt vorherige Jira-Daten des Projekts (kein Append)

#### FEAT-005: OpenAir-Import
**Als** Projektleiter **möchte ich** einen OpenAir Excel-Export hochladen **damit** Budget- und Ressourcendaten im Dashboard verfügbar sind.
- [ ] Gleiche Upload-Regeln wie FEAT-004
- [ ] Parser erkennt OpenAir-Projektspalten
- [ ] Fehlende Budget-Daten → Warnung (kein harter Fehler)
- [ ] Import-Log-Eintrag analog FEAT-004

#### FEAT-006: Projektdetail-Dashboard
**Als** Projektleiter **möchte ich** den Projektzustand auf einem Dashboard sehen **damit** ich schnell Handlungsbedarf erkenne.
- [ ] Vier Kacheln: Budget, Zeitplan, Ressourcen, Scope (je mit Ampel)
- [ ] Gesamtstabilitätsampel oben prominent
- [ ] Budget-Kachel: Ist €, Plan €, Differenz €, Burn Rate
- [ ] Zeitplan-Kachel: Meilensteine (geplant vs. aktuell), nächster Meilenstein
- [ ] Ressourcen-Kachel: Auslastung % je Rolle (Balkendiagramm)
- [ ] Scope-Kachel: Story Points geplant vs. aktuell, offene Issues nach Typ
- [ ] Hinweis wenn noch kein Import vorhanden ("Daten importieren um zu starten")

#### FEAT-007: Schwellenwert-Konfiguration
**Als** Projektleiter **möchte ich** die Grenzwerte für die Ampellogik pro Projekt einstellen **damit** die Ampel meinen Projektkontext widerspiegelt.
- [ ] Einstellbar: Budget-Abweichung % (gelb/rot Schwelle)
- [ ] Einstellbar: Zeitverzug in Tagen (gelb/rot Schwelle)
- [ ] Einstellbar: Ressourcenauslastung % max (gelb/rot)
- [ ] Einstellbar: Scope-Wachstum % (gelb/rot)
- [ ] Default-Werte vorbefüllt (15%/25% Budget; 5/15 Tage; 85%/100% Auslastung; 10%/20% Scope)
- [ ] Änderungen wirken sofort auf Dashboard-Berechnung

---

## 4. Testing-Regeln

### Pflicht
- Jede Parser-Funktion (`jira-parser.ts`, `openair-parser.ts`) hat Unit Tests
- Jede KPI-Berechnungsfunktion hat Unit Tests
- Jede API Route hat mindestens einen Integrationstest
- Ampellogik (`stability-index.ts`) hat Tests für alle Grenzfälle (inkl. Boundary-Werte)

### Test-Framework
- **Vitest** für Unit- und Integrationstests
- **React Testing Library** für Komponenten-Tests (nur kritische Komponenten)
- **Playwright** für E2E (Phase 2, nicht MVP)

### Konventionen
```typescript
// Dateiname: [modul].test.ts oder [modul].spec.ts
// Struktur:
describe('jiraParser', () => {
  describe('parseIssues', () => {
    it('should map standard Jira columns correctly', () => { ... })
    it('should ignore unknown columns without error', () => { ... })
    it('should return error for missing Issue Key', () => { ... })
  })
})
```

### Coverage-Ziele (MVP)
| Bereich | Ziel |
|---|---|
| Parser | ≥ 90% |
| Berechnungen / Ampellogik | ≥ 95% |
| API Routes | ≥ 80% |
| UI-Komponenten | ≥ 60% |

### Testdaten
- Alle Fixtures sind **synthetisch generiert** – keine echten Projektdaten im Repository
- `/tests/fixtures/generate-fixtures.ts` – Skript das alle Fixtures per SheetJS erzeugt, muss bei Schemaänderungen aktualisiert werden
- `/tests/fixtures/jira-sample.xlsx` – valide Jira-Exportdatei (5 Issues, 2 Sprints, EN-Spalten)
- `/tests/fixtures/jira-german-columns.xlsx` – gleiche Daten mit deutschen Spaltennamen
- `/tests/fixtures/jira-missing-key.xlsx` – Jira-Datei mit fehlendem Issue Key in Zeile 3
- `/tests/fixtures/openair-sample.xlsx` – generische OpenAir-artige Datei (Timesheets + Budget + Meilensteine)
- `/tests/fixtures/openair-partial.xlsx` – OpenAir-Datei mit fehlenden Budget-Feldern (löst Warnung aus)
- Fixtures werden committet; Regenerierung via `npx tsx tests/fixtures/generate-fixtures.ts`

---

## 5. Datenbankregeln (Supabase)

### Migrations
- Jede Schemaänderung als eigene Migration: `/supabase/migrations/YYYYMMDD_beschreibung.sql`
- Migrations sind niemals rückwärts kompatibel zu brechen ohne expliziten Hinweis
- Keine direkten Schema-Änderungen über Supabase-Dashboard in Production

### Row Level Security (RLS)
- **RLS ist für jede Tabelle aktiviert** – keine Ausnahmen
- Policies folgen dem Muster: Nutzer sieht nur Daten seiner Projekte
- Im MVP: `auth.uid() = projects.owner_id` oder via `project_members`-Tabelle
- Policies müssen vor Feature-Implementation existieren

### Naming
- Tabellen: `snake_case`, Plural (`projects`, `jira_issues`, `import_logs`)
- Spalten: `snake_case` (`created_at`, `project_id`, `story_points`)
- Foreign Keys: `[referenzierte_tabelle_singular]_id` (`project_id`, `user_id`)
- Timestamps: immer `created_at` und `updated_at` (Trigger für `updated_at`)

### Kern-Schema (MVP)
```sql
-- projects, project_members, jira_issues, jira_sprints,
-- oa_timesheets, oa_milestones, oa_projects,
-- import_logs, project_thresholds
-- (Detailliertes Schema in /supabase/migrations/001_initial_schema.sql)
```

---

## 6. Dokumentation (arc42)

Die Architekturdokumentation folgt arc42 und liegt in `/docs/arc42/`.

### Pflicht-Kapitel (MVP)
| Kapitel | Datei | Status |
|---|---|---|
| 1. Einführung und Ziele | `01_introduction.md` | Beim Projektstart |
| 2. Randbedingungen | `02_constraints.md` | Beim Projektstart |
| 3. Kontextabgrenzung | `03_context.md` | Beim Projektstart |
| 4. Lösungsstrategie | `04_solution_strategy.md` | Nach Architekturentscheidungen |
| 5. Bausteinsicht | `05_building_blocks.md` | Nach erstem Feature |
| 6. Laufzeitsicht | `06_runtime.md` | Nach Import-Feature |
| 9. Architekturentscheidungen | `09_decisions/` | Für jede ADR |
| 10. Qualitätsanforderungen | `10_quality.md` | Beim Projektstart |

### Architecture Decision Records (ADR)
Format: `/docs/arc42/09_decisions/ADR-XXX-titel.md`

```markdown
# ADR-001: Titel

**Status:** Akzeptiert | Abgelehnt | Ersetzt durch ADR-XXX
**Datum:** YYYY-MM-DD

## Kontext
[Problem das gelöst werden muss]

## Entscheidung
[Was wurde entschieden]

## Konsequenzen
**Positiv:** ...
**Negativ:** ...
```

### Vorhandene ADRs
- **ADR-001:** Supabase statt eigenem Backend (Schnelligkeit, Auth, RLS out-of-the-box)
- **ADR-002:** Excel-Import statt API-Direktanbindung (MVP-Pragmatismus, keine API-Credentials nötig)
- **ADR-003:** shadcn/ui statt komplett eigenes Designsystem (Produktivität, Konsistenz)
- **ADR-004:** App Router (Next.js 14) statt Pages Router (Zukunftssicherheit, Server Components)

---

## 7. Code-Qualität & Konventionen

### TypeScript
```typescript
// Gut: Explizite Typen
function calculateBurnRate(spent: number, planned: number): number { ... }

// Schlecht: any
function calculate(a: any, b: any): any { ... }
```

### Fehlerbehandlung
```typescript
// API Routes immer mit strukturiertem Error-Response
return NextResponse.json(
  { error: 'IMPORT_PARSE_ERROR', message: 'Column "Issue Key" missing in row 3', details: { row: 3 } },
  { status: 422 }
)
```

### Server Actions
```typescript
'use server'
// Alle Server Actions validieren Input mit Zod
// Alle Server Actions geben { data, error } zurück (nie throw)
```

### Commits
- Format: `feat:`, `fix:`, `chore:`, `docs:`, `test:` + kurze Beschreibung auf Deutsch oder Englisch
- Kein Commit ohne zugehörigen Test bei neuer Businesslogik
