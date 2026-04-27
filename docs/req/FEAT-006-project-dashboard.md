## [FEAT-006] Projektdetail-Dashboard

**Als** Projektleiter
**möchte ich** den Projektzustand auf einem Dashboard sehen
**damit** ich schnell Handlungsbedarf erkenne.

### Akzeptanzkriterien

- [ ] AC1: Vier Kacheln: Budget, Zeitplan, Ressourcen, Scope (je mit Ampel)
- [ ] AC2: Gesamtstabilitätsampel oben prominent angezeigt
- [ ] AC3: Budget-Kachel: Ist €, Plan €, Differenz €, Burn Rate €/Monat
- [ ] AC4: Zeitplan-Kachel: Meilensteine geplant vs. aktuell, nächster Meilenstein
- [ ] AC5: Ressourcen-Kachel: Auslastung % je Rolle (Balkendiagramm)
- [ ] AC6: Scope-Kachel: Story Points geplant vs. aktuell, offene Issues nach Typ
- [ ] AC7: Hinweis wenn noch kein Import vorhanden ("Daten importieren um zu starten")
- [ ] AC8: Alle KPIs werden serverseitig berechnet (keine Client-Requests für Daten)

### Gherkin-Szenarien

```gherkin
Feature: Projektdetail-Dashboard

  Scenario: Dashboard mit Import-Daten
    Given ein Projekt mit Jira- und OpenAir-Import-Daten
    When der Nutzer das Dashboard öffnet
    Then sieht er vier Kacheln mit Ampelfarben
    And die Gesamtstabilitätsampel ist sichtbar

  Scenario: Dashboard ohne Import-Daten
    Given ein Projekt ohne bisherige Importe
    When der Nutzer das Dashboard öffnet
    Then sieht er einen Hinweis "Daten importieren um zu starten"
    And es gibt keine leeren/fehlerhaften Kacheln

  Scenario: Budget-Kachel
    Given Budget-Daten mit Ist > Plan
    Then ist die Budget-Kachel rot
    And zeigt Differenz negativ (über Budget)

  Scenario: Ressourcen-Kachel
    Given Timesheet-Daten mit Überauslastung einer Rolle
    Then zeigt die Ressourcen-Kachel die betroffene Rolle in Rot
```

### Filter-Erweiterungen (nachträglich ergänzt)

```gherkin
  Scenario: Team-Filter — kein Filter aktiv
    Given ein Projekt mit OpenAir-Timesheets verschiedener Teams
    When der Nutzer das Dashboard ohne team-Parameter öffnet
    Then zeigt die Ressourcen-Kachel die Auslastung aller Teams aggregiert
    And die Time-Analysis-Kachel zeigt die Stunden aller Teams im aktuellen Monat
    And ein "Team"-Popover-Filter ist im Filter-Bar sichtbar mit Label "All teams"

  Scenario: Team-Filter — ein Team ausgewählt
    Given ein Projekt mit Teams "Team Alpha" und "Team Panda"
    When der Nutzer "Team Alpha" im Team-Filter auswählt
    Then ist der URL-Parameter ?team=Team+Alpha gesetzt
    And die Ressourcen-Kachel zeigt nur Auslastung der Rollen aus Team Alpha
    And die Time-Analysis-Kachel zeigt nur Stunden von Team Alpha im aktuellen Monat
    And der Filter-Label zeigt "Team Alpha"

  Scenario: Team-Filter — mehrere Teams ausgewählt
    Given ein Projekt mit Teams "Team Alpha" und "Team Panda"
    When der Nutzer beide Teams im Filter auswählt
    Then ist der URL-Parameter ?team=Team+Alpha&team=Team+Panda gesetzt
    And der Filter-Label zeigt "2 teams"

  Scenario: Team-Filter — nicht sichtbar ohne Team-Daten
    Given ein Projekt ohne OpenAir-Timesheets oder ohne Team-Spalte in den Daten
    When der Nutzer das Dashboard öffnet
    Then ist kein Team-Filter-Element im Filter-Bar sichtbar

  Scenario: Sprint-Filter — Scope-Kachel gefiltert
    Given ein Projekt mit konfigurierten Sprints (FEAT-009)
    When der Nutzer einen Sprint im Sprint-Filter auswählt
    Then zeigt die Scope-Kachel nur Jira-Issues deren sprint-Feld den Sprint-Namen enthält
    And die Time-Analysis-Kachel bleibt unverändert (zeigt aktuellen Monat)

  Scenario: Sprint- und Team-Filter — gleichzeitig aktiv
    Given ein Projekt mit konfigurierten Sprints und Teams
    When der Nutzer einen Sprint und ein Team gleichzeitig auswählt
    Then zeigt die Scope-Kachel Issues des gewählten Sprints
    And die Ressourcen-Kachel zeigt nur Daten des gewählten Teams
    And die Stabilitätsampel bleibt unverändert (zeigt immer Gesamtstatus)
```

### Technische Hinweise

- KPI-Berechnungen: `/lib/calculations/kpi-calculations.ts` (pure functions, Phase 4.1)
- Stabilitätsindex: `/lib/calculations/stability-index.ts` (Phase 4.2)
- Datenladen: Server Component — ein DB-Query pro Datenquelle, keine N+1
- Charts: Recharts mit `ResponsiveContainer` (alle Diagramme responsiv)
- Kein Loading-State nötig (Server Component lädt alles vorab)

### KPI-Berechnungslogik

**Budget (`calcBudgetKPIs`)**
- `plannedEur` = Σ aller `plannedEur`-Einträge
- `actualEur` = Σ aller `actualEur`-Einträge
- `differenceEur` = `actualEur − plannedEur` (positiv = über Budget)
- `differencePct` = `differenceEur / plannedEur × 100` (0 wenn kein Plan)
- `burnRate` = `actualEur / elapsedDays × 30` (monatlich, basierend auf Period-Dates)
- `eac` = `actualEur + (totalBudget − plannedEur)` (vereinfacht)

**Zeitplan (`calcScheduleKPIs`)**
- `delayedMilestones` = Meilensteine wo `actualDate > plannedDate`
- `maxDelayDays` = maximale Verzögerung in Tagen
- `nextMilestone` = frühester nicht-abgeschlossener Meilenstein (status ≠ "completed")

**Ressourcen (`calcResourceKPIs`)**
- Aggregation nach `role`
- `utilizationPct` = `bookedHours / plannedHours × 100`
- `overallUtilizationPct` = Gesamtbuchung / Gesamtplan × 100

**Scope (`calcScopeKPIs`)**
- `openIssues` = Issues mit Status außer Done/Closed/Resolved
- `velocityTrend` = `completedPoints` der letzten 3 Sprints
- `bugRate` = Anteil Issues vom Typ "Bug" in Prozent
