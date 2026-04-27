## [FEAT-007] Schwellenwert-Konfiguration

**Als** Projektleiter
**möchte ich** die Grenzwerte für die Ampellogik pro Projekt einstellen
**damit** die Ampel meinen Projektkontext widerspiegelt.

### Akzeptanzkriterien

- [ ] AC1: Einstellbar: Budget-Abweichung % (gelb/rot Schwelle)
- [ ] AC2: Einstellbar: Zeitverzug in Tagen (gelb/rot Schwelle)
- [ ] AC3: Einstellbar: Ressourcenauslastung % max (gelb/rot)
- [ ] AC4: Einstellbar: Scope-Wachstum % (gelb/rot)
- [ ] AC5: Einstellbar: Epic-Warngrenze % (einzelner Wert — wie viel % Restpuffer löst Gelb aus)
- [ ] AC6: Default-Werte vorbefüllt (15%/25% Budget; 5/15 Tage; 85%/100% Auslastung; 10%/20% Scope; 10% Epic-Warngrenze)
- [ ] AC7: Roter Schwellenwert muss strenger (größer) als gelber sein — Validierungsfehler sonst (gilt für Budget, Zeit, Ressourcen, Scope; Epic hat nur einen Wert)
- [ ] AC8: Nach Speichern: Erfolgsmeldung sichtbar
- [ ] AC9: Reset-Button setzt auf Default-Werte zurück (mit Bestätigungs-Dialog)
- [ ] AC10: Änderungen wirken sofort auf Dashboard-Berechnung (kein manuelles Neu-Laden nötig)
- [ ] AC11: Fehlermeldungen erscheinen inline unter dem betroffenen Feld

### Gherkin-Szenarien

```gherkin
Feature: Schwellenwert-Konfiguration

  Scenario: Gültige Schwellenwerte speichern
    Given ein Projektleiter ist auf der Settings-Seite
    When er den Budget-Gelb-Schwellenwert auf 20% und Budget-Rot auf 30% setzt
    And auf "Save thresholds" klickt
    Then erscheint eine Erfolgsmeldung "Thresholds saved successfully"
    And das Dashboard verwendet ab sofort die neuen Schwellenwerte

  Scenario: Ungültige Schwellenwerte werden abgelehnt
    Given ein Projektleiter ist auf der Settings-Seite
    When er den Budget-Gelb-Schwellenwert auf 30% und Budget-Rot auf 20% setzt
    And auf "Save thresholds" klickt
    Then erscheint eine Fehlermeldung beim Budget-Rot-Feld
    And es wird kein Datenbankschreibvorgang ausgeführt

  Scenario: Gleiche Schwellenwerte werden abgelehnt
    Given ein Projektleiter ist auf der Settings-Seite
    When er Gelb-Schwelle und Rot-Schwelle auf denselben Wert setzt
    Then erscheint eine Fehlermeldung (Rot muss strenger als Gelb sein)

  Scenario: Reset auf Defaults
    Given ein Projektleiter hat benutzerdefinierte Schwellenwerte gesetzt
    When er auf "Reset to defaults" klickt
    And den Bestätigungs-Dialog bestätigt
    Then werden alle acht Felder auf die Default-Werte zurückgesetzt
    And eine Erfolgsmeldung erscheint

  Scenario: Abbrechen des Resets
    Given der Bestätigungs-Dialog für den Reset ist offen
    When der Nutzer auf "Cancel" klickt
    Then bleibt der Dialog geschlossen und die aktuellen Werte bleiben erhalten

  Scenario: Vorhandene Werte werden beim Öffnen vorausgefüllt
    Given ein Projekt mit gespeicherten Schwellenwerten (Budget Gelb: 20%, Rot: 35%)
    When der Nutzer die Settings-Seite öffnet
    Then sind die Felder mit den gespeicherten Werten vorausgefüllt

  Scenario: Epic-Warngrenze speichern
    Given ein Projektleiter ist auf der Settings-Seite
    When er die Epic-Warngrenze auf 15% setzt und speichert
    Then erscheint eine Erfolgsmeldung "Thresholds saved successfully"
    And die Epic-Budget-Kachel verwendet ab sofort 15% als Warnschwelle
    And ein Epic mit 87 % Auslastung wird gelb angezeigt (≥ 85 %, also innerhalb der 15 %-Warnzone)

  Scenario: Epic-Warngrenze — Default 10 %
    Given ein neu angelegtes Projekt ohne gespeicherte Schwellenwerte
    When der Nutzer die Settings-Seite öffnet
    Then ist die Epic-Warngrenze mit 10 % vorbefüllt
```

### Technische Hinweise

- Zod-Schema: `/lib/validations/thresholds.schema.ts`
  - `pctField`: `z.coerce.number().min(0).max(200)` (Koerzion für FormData-Strings)
  - `daysField`: `z.coerce.number().int().min(0)`
  - 4 Refinements: `red > yellow` für Budget, Zeit, Ressourcen, Scope
  - `epicWarningMarginPct`: `z.coerce.number().min(1).max(99)` — kein Rot/Gelb-Paar, nur ein Wert
  - Fehlermeldung bei Verletzung aus zentralem `ERRORS.THRESHOLD_INVALID_RANGE`
- Server Actions: `/lib/actions/threshold.actions.ts`
  - `updateThresholds(projectId, prevState, formData)` — verwendet mit `useFormState`
  - `resetThresholds(projectId)` — direkt aus Client-Komponente aufgerufen
  - Beide Actions prüfen Auth und Projektzugehörigkeit vor DB-Zugriff
- Formular-Komponente: `/components/dashboard/thresholds-form.tsx` (`"use client"`)
  - `useFormState` für das Haupt-Speicherformular
  - `useTransition` + direkter Server-Action-Aufruf für Reset
  - `router.refresh()` nach Erfolg — lädt Seite neu, ohne Full-Page-Reload
- Seite: `/app/(dashboard)/projects/[id]/settings/page.tsx` (Server Component)
  - Lädt `project_thresholds` aus Supabase
  - Fällt auf `DEFAULT_THRESHOLDS` zurück, wenn kein Eintrag vorhanden

### Default-Werte

| Dimension | Gelb | Rot |
|---|---|---|
| Budget-Abweichung | 15 % | 25 % |
| Zeitverzug | 5 Tage | 15 Tage |
| Ressourcenauslastung | 85 % | 100 % |
| Scope-Wachstum | 10 % | 20 % |
| Epic-Warngrenze | 10 % | — (kein separater Rot-Wert; Rot = ≥ 100 % Auslastung) |
