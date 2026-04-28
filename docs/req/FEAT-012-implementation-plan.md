# FEAT-012: Implementation Plan — Quality Tile & Bug Lead Time Analysis

Abhängigkeiten fließen von oben nach unten. Jeder Schritt kann erst beginnen, wenn der vorherige abgeschlossen ist, sofern nicht anders vermerkt.

---

## Schritt 1 — DB-Migration

**Datei:** `supabase/migrations/YYYYMMDD_add_quality_fields.sql`

```sql
ALTER TABLE jira_issues
  ADD COLUMN priority text,
  ADD COLUMN team     text;

ALTER TABLE project_thresholds
  ADD COLUMN quality_lead_critical_days integer NOT NULL DEFAULT 5,
  ADD COLUMN quality_lead_major_days    integer NOT NULL DEFAULT 10,
  ADD COLUMN quality_lead_minor_days    integer NOT NULL DEFAULT 20,
  ADD COLUMN quality_lead_trivial_days  integer NOT NULL DEFAULT 50;
```

`database.types.ts` muss danach mit `supabase gen types` aktualisiert werden.

---

## Schritt 2 — Tests: Arbeitstage-Berechnung (TDD)

**Datei:** `tests/calculations/quality-calculations.test.ts` (neu)

Testfälle (vor der Implementierung schreiben):
- Gleicher Tag → 0
- Mo–Fr ohne Feiertag → korrekter Wert
- Überspannt Wochenende → Wochenende nicht gezählt
- Überspannt Karfreitag 2026 (3. Apr) → Feiertag nicht gezählt
- Überspannt Ostermontag 2026 (6. Apr) → Feiertag nicht gezählt
- Überspannt Weihnachten → 25. + 26. Dez nicht gezählt
- `resolved < created` → 0
- `germanHolidays(2026)`: prüft mind. Karfreitag = 3. Apr und Ostermontag = 6. Apr

---

## Schritt 3 — Implementierung: Arbeitstage-Berechnung

**Datei:** `lib/calculations/quality-calculations.ts` (neu, nur diese Funktionen)

```typescript
function easterSunday(year: number): Date          // Anonymous Gregorian algorithm
function germanHolidays(year: number): Date[]      // 9 Bundesfeiertage
function calcWorkingDays(start: Date, end: Date): number
```

Ziel: alle Tests aus Schritt 2 grün.

---

## Schritt 4 — Tests: Quality-KPI-Funktionen (TDD)

**Datei:** `tests/calculations/quality-calculations.test.ts` (erweitern)

Testfälle:
- `calcOpenBugsByPriority`: alle Prioritäten vorhanden / manche fehlen / keine Bugs
- `calcAvgHoursByPriority`: ticketRef matcht / kein Match / mehrere Timesheets pro Bug
- `calcBugLeadTimes`: genau am Schwellenwert (grün) / einen drüber (rot) / keine Priorität (none)

---

## Schritt 5 — Implementierung: Quality-KPI-Funktionen

**Datei:** `lib/calculations/quality-calculations.ts` (erweitern)

```typescript
function calcOpenBugsByPriority(bugs: JiraIssue[]): OpenBugsByPriority
function calcAvgHoursByPriority(bugs: JiraIssue[], timesheets: OATimesheet[]): AvgHoursByPriority
function calcBugLeadTimes(bugs: JiraIssue[], thresholds: QualityThresholds): BugLeadTimeRow[]
```

Neue Domain-Types in `types/domain.types.ts`:
- `BugPriority`
- `OpenBugsByPriority`
- `AvgHoursByPriority`
- `BugLeadTimeRow`
- `QualityThresholds`

---

## Schritt 6 — Jira-Parser erweitern (Tests zuerst)

**Test-Datei:** `tests/parsers/jira-parser.test.ts` (erweitern)

Testfälle:
- Priority-Spalte vorhanden mit bekannten Werten → korrekt gemappt
- Priority-Spalte fehlt → `null`
- Teams-Spalte vorhanden → korrekt gemappt
- Teams-Spalte fehlt → `null`

**Implementierung:** `lib/parsers/jira-parser.ts`

```typescript
const COL_PRIORITY = ["priority", "priorität", "prioritaet"];
const COL_TEAM     = ["teams", "team"];
```

Beide Felder in `JiraIssue` (domain type) + in `parseIssuesSheet()` aufnehmen.

---

## Schritt 7 — Schema- und Type-Erweiterungen

Dateien:

**`lib/validations/thresholds.schema.ts`**
- 4 neue Felder: `quality_lead_critical_days`, `quality_lead_major_days`, `quality_lead_minor_days`, `quality_lead_trivial_days`
- Alle `z.coerce.number().int().min(1)`
- In `DEFAULT_THRESHOLDS` mit Defaults 5 / 10 / 20 / 50

**`types/domain.types.ts`**
- `ProjectThresholds` um `qualityLeadCriticalDays`, `qualityLeadMajorDays`, `qualityLeadMinorDays`, `qualityLeadTrivialDays` erweitern

**`lib/actions/threshold.actions.ts`**
- Mapping von DB-Spalten auf Domain-Type erweitern

---

## Schritt 8 — Import-Route erweitern

**Datei:** `app/api/projects/[id]/import/route.ts`

`priority` und `team` in das `INSERT`-Mapping für `jira_issues` aufnehmen, damit die Parser-Werte auch in der DB landen.

---

## Schritt 9 — QualityCard-Komponente

**Datei:** `components/dashboard/quality-card.tsx` (neu)

Props:
```typescript
{
  projectId: string;
  openByPriority: OpenBugsByPriority | null;  // null = kein Jira-Import
  searchString: string;                        // aktive URL-Params weiterleiten
}
```

- Zeigt offene Bugs-Anzahl gesamt + Breakdown nach Priorität
- Kein Ampelstatus
- Klick → Navigation zu `/projects/[id]/quality?{searchString}`
- Bei `null`: Platzhalter "—"

---

## Schritt 10 — Dashboard einbinden

**Datei:** `app/(dashboard)/projects/[id]/page.tsx`

- Bugs serverseitig laden: `jira_issues WHERE issue_type = 'Bug'`
- `calcOpenBugsByPriority()` aufrufen
- `<QualityCard>` in das Kachel-Grid einbauen
- `searchString` (aktive Filter) weiterleiten

---

## Schritt 11 — Quality-Detailseite

**Datei:** `app/(dashboard)/projects/[id]/quality/page.tsx` (neu, Server Component)

URL-Parameter: `team` (repeated), `sprint` (repeated)

Daten serverseitig:
1. Bugs: `jira_issues WHERE project_id = id AND issue_type = 'Bug'`
2. Alle Timesheets des Projekts
3. `project_thresholds` (Leadtime-Schwellenwerte)
4. `project_sprints` (für Sprint-Filter-UI)

Filter-Logik:
- Team-Filter: `bug.team === selectedTeam` (Jira-Feld)
- Sprint-Filter: `bug.sprint` enthält Sprint-Name

3 Sektionen:
1. **Open Bugs** — Anzahl nach Priorität (Kacheln/Badges)
2. **Avg Hours per Priority** — Tabelle mit Ø-Stunden je Priorität
3. **Closed Bugs — Lead Time** — Tabelle: Issue Key | Summary | Priority | Created | Resolved | Lead Time | Status (rot/grün)

---

## Schritt 12 — Settings-Seite erweitern (FEAT-007)

**Dateien:**
- `components/dashboard/thresholds-form.tsx` — neuen Abschnitt "Quality: Lead Time Thresholds" mit 4 Feldern
- `app/(dashboard)/projects/[id]/settings/page.tsx` — neue Felder aus DB laden + übergeben

Default-Werte vorbelegt: Critical 5 / Major 10 / Minor 20 / Trivial 50 Arbeitstage.

---

## Schritt 13 — E2E-Tests

**Datei:** `e2e/quality.spec.ts` (neu)

Szenarien:
- Dashboard zeigt Quality-Kachel mit Bug-Anzahl
- Klick auf Kachel navigiert zur Detailseite
- Detailseite zeigt Lead-Time-Tabelle mit korrekter Farbkodierung
- Team-Filter auf Detailseite filtert Tabellenzeilen
- Settings-Seite zeigt die neuen Quality-Felder, Speichern persistiert Werte

---

## Status-Übersicht

| # | Schritt | Status |
|---|---|---|
| 1 | DB-Migration | ⬜ offen |
| 2 | Tests: Arbeitstage | ⬜ offen |
| 3 | Impl: Arbeitstage | ⬜ offen |
| 4 | Tests: Quality-KPIs | ⬜ offen |
| 5 | Impl: Quality-KPIs | ⬜ offen |
| 6 | Jira-Parser (Tests + Impl) | ⬜ offen |
| 7 | Schema + Types | ⬜ offen |
| 8 | Import-Route | ⬜ offen |
| 9 | QualityCard-Komponente | ⬜ offen |
| 10 | Dashboard einbinden | ⬜ offen |
| 11 | Quality-Detailseite | ⬜ offen |
| 12 | Settings-Seite (FEAT-007) | ⬜ offen |
| 13 | E2E-Tests | ⬜ offen |
