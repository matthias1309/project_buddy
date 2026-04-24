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
