## [FEAT-004] Jira Excel Import

**Als** Projektleiter
**möchte ich** eine Jira Excel-Exportdatei hochladen
**damit** Delivery-Daten im Dashboard verfügbar sind.

### Akzeptanzkriterien

- [ ] AC1: Dateiupload akzeptiert `.xlsx` und `.xls`
- [ ] AC2: Maximale Dateigröße: 10 MB (Fehlermeldung bei Überschreitung)
- [ ] AC3: Parser erkennt Standard-Jira-Spalten automatisch (case-insensitive)
- [ ] AC4: Unbekannte Spalten werden ignoriert (kein Fehler)
- [ ] AC5: Fehlende Pflichtfelder (Issue Key, Status) → Fehlermeldung mit Zeilennummer
- [ ] AC6: Erfolgreicher Import: Anzahl importierter Issues angezeigt
- [ ] AC7: Import-Log-Eintrag wird erstellt (Datum, Dateiname, Status, Anzahl)
- [ ] AC8: Erneuter Import überschreibt vorherige Jira-Daten des Projekts (kein Append)
- [ ] AC9: Deutsche Spaltennamen werden erkannt (Zusammenfassung, Vorgangstyp, etc.)
- [ ] AC10: Leere Zeilen werden ohne Fehler übersprungen

### Gherkin-Szenarien

```gherkin
Feature: Jira Excel Import

  Scenario: Valide englische Spaltennamen
    Given eine .xlsx-Datei mit 5 Issues und Standard-Jira-Spalten (EN)
    When die Datei importiert wird
    Then werden 5 JiraIssue-Objekte zurückgegeben
    And es gibt keine ParseErrors

  Scenario: Valide deutsche Spaltennamen
    Given eine .xlsx-Datei mit deutschen Spaltennamen (Vorgangsschlüssel, Zusammenfassung etc.)
    When die Datei importiert wird
    Then werden alle Issues korrekt gemappt

  Scenario: Fehlender Issue Key
    Given eine .xlsx-Datei wo Zeile 3 keinen Issue Key hat
    When die Datei importiert wird
    Then enthält das Ergebnis einen ParseError mit row: 3

  Scenario: Unbekannte Spalten
    Given eine .xlsx-Datei mit zusätzlichen unbekannten Spalten
    When die Datei importiert wird
    Then werden unbekannte Spalten ignoriert
    And es gibt keine ParseErrors

  Scenario: Leere Zeilen
    Given eine .xlsx-Datei mit Leerzeilen zwischen den Issues
    When die Datei importiert wird
    Then werden Leerzeilen übersprungen
```

### Technische Hinweise

- Parser-Implementierung: `/lib/parsers/jira-parser.ts`
- Rückgabetyp: `JiraParseResult` aus `/types/domain.types.ts`
- Spalten-Mapping ist case-insensitiv
- Pflichtfelder: `issueKey` und `status` — fehlen sie, wird ein `ParseError` erzeugt (Zeile nicht importiert)
- Sprint-Daten werden aus einem separaten "Sprints"-Sheet gelesen, falls vorhanden
- Datum-Parsing: ISO-Strings und Excel-Serial-Dates werden unterstützt
- Testfixtures: `/tests/fixtures/jira-*.xlsx` (synthetisch generiert)
