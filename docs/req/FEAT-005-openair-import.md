## [FEAT-005] OpenAir Excel Import

**Als** Projektleiter
**möchte ich** einen OpenAir Excel-Export hochladen
**damit** Budget- und Ressourcendaten im Dashboard verfügbar sind.

### Akzeptanzkriterien

- [ ] AC1: Dateiupload akzeptiert `.xlsx` und `.xls`
- [ ] AC2: Maximale Dateigröße: 10 MB (Fehlermeldung bei Überschreitung)
- [ ] AC3: Parser erkennt OpenAir-Projektspalten automatisch (case-insensitive, EN + DE)
- [ ] AC4: Fehlende Budget-Daten → Warnung (kein harter Fehler)
- [ ] AC5: Negative Stunden → Warnung (kein harter Fehler)
- [ ] AC6: Unbekannte Spalten werden ignoriert
- [ ] AC7: Leere Zeilen werden übersprungen
- [ ] AC8: Import-Log-Eintrag analog FEAT-004 (Datum, Dateiname, Status, Anzahl)
- [ ] AC9: Mehrere Daten-Blöcke auf einem Sheet werden anhand von Header-Zeilen erkannt
- [ ] AC10: Erneuter Import überschreibt vorherige OpenAir-Daten (kein Append)

### Gherkin-Szenarien

```gherkin
Feature: OpenAir Excel Import

  Scenario: Valide Datei mit getrennten Sheets
    Given eine .xlsx-Datei mit Sheets "Timesheets", "Budget", "Meilensteine"
    When die Datei importiert wird
    Then werden Timesheets, Budget-Einträge und Meilensteine korrekt geparst
    And es gibt keine ParseErrors und keine Warnings

  Scenario: Fehlender Budget-Sheet
    Given eine .xlsx-Datei ohne Budget-Sheet (nur Timesheets und Meilensteine)
    When die Datei importiert wird
    Then sind budgetEntries leer
    And enthält das Ergebnis eine Warning über fehlende Budget-Daten

  Scenario: Negative Stunden
    Given eine Timesheet-Zeile mit gebuchten Stunden < 0
    When die Datei importiert wird
    Then enthält das Ergebnis eine Warning
    And der Eintrag wird trotzdem importiert

  Scenario: Unbekannte Spalten
    Given eine Datei mit zusätzlichen unbekannten Spalten
    When die Datei importiert wird
    Then werden unbekannte Spalten ignoriert
    And es gibt keine Errors

  Scenario: Block-Erkennung auf einem Sheet
    Given ein einzelnes Sheet mit mehreren Blöcken (Timesheets und Budget in einem Sheet)
    When die Datei importiert wird
    Then werden beide Blöcke korrekt geparst
```

### Technische Hinweise

- Parser-Implementierung: `/lib/parsers/openair-parser.ts`
- Rückgabetyp: `OpenAirParseResult` aus `/types/domain.types.ts`
- Spalten-Mapping für Timesheets:
  - "Mitarbeiter" / "Employee" → `employeeName`
  - "Rolle" / "Role" / "Job Code" → `role`
  - "Phase" / "Task" → `phase`
  - "Geplante Stunden" / "Planned Hours" / "Budget Hours" → `plannedHours`
  - "Gebuchte Stunden" / "Actual Hours" / "Hours" → `bookedHours`
  - "Datum" / "Date" / "Period" → `periodDate`
- Spalten-Mapping für Budget:
  - "Kategorie" / "Category" → `category`
  - "Geplant (EUR)" / "Planned (EUR)" / "Budget" → `plannedEur`
  - "Ist (EUR)" / "Actual (EUR)" / "Actual" → `actualEur`
  - "Periode" / "Period" / "Date" → `periodDate`
- Spalten-Mapping für Meilensteine:
  - "Name" → `name`
  - "Geplant" / "Planned Date" → `plannedDate`
  - "Aktuell" / "Actual Date" → `actualDate`
  - "Status" → `status`
- Sheet-Erkennung: Sheet-Name → Fallback auf Header-Analyse → Block-Erkennung
- Testfixtures: `/tests/fixtures/openair-*.xlsx` (synthetisch generiert)
