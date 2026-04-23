# Projektkontext: PM-Dashboard (Intranet)

## Über das Projekt

Das PM-Dashboard ist eine interne Webanwendung für ein mittelständisches Consulting- und Softwareunternehmen. Es dient Projektleitern als zentrales Steuerungs- und Übersichts-Werkzeug, das Daten aus **Jira** (technische Delivery) und **OpenAir** (kaufmännisch / Ressourcen) zusammenführt und als konsolidiertes Dashboard darstellt.

Die Anwendung läuft im Intranet des Unternehmens und ist nicht öffentlich erreichbar.

---

## Geschäftliche Motivation

Projektleiter arbeiten heute mit mindestens zwei getrennten Tools:
- **Jira** für die technische Steuerung (Stories, Bugs, Sprints, Epics)
- **OpenAir** für Zeit-, Budget- und Ressourcenplanung

Es gibt keine gemeinsame Sicht auf den „Projektzustand". Das PM-Dashboard schließt diese Lücke, indem es Excel-Exporte beider Systeme importiert, zu einem einheitlichen Datenmodell zusammenführt und auf vier Stabilitätsdimensionen aggregiert.

---

## Zielgruppen & Rollen

### MVP (Phase 1)
| Rolle | Beschreibung |
|---|---|
| **Projektleiter** | Vollzugriff auf alle Dashboards und Import-Funktionen seiner Projekte |

### Phase 2+ (vorbereitet, nicht implementiert im MVP)
| Rolle | Sichtbarkeit |
|---|---|
| **Product Owner (PO)** | Delivery-fokussierte Sicht: Jira-Daten, Scope, Sprint-Burndown |
| **Programm Manager** | Portfolio-Sicht: alle Projekte, aggregierte KPIs, Budget-Rollup |
| **Consultant / Entwickler** | Read-only Sicht: eigene Auslastung |

> **Architekturhinweis:** Das Datenmodell und die API-Schicht müssen von Anfang an rollenbasiert ausgelegt sein (Row Level Security in Supabase). Im MVP gibt es nur die Rolle `project_manager`, aber die Struktur muss erweiterbar sein.

---

## Vier Stabilitätsdimensionen

Das Dashboard zeigt den Projektzustand entlang von vier Dimensionen:

| Dimension | Primäre Quelle | Kernindikatoren |
|---|---|---|
| **Budget / Kostentreue** | OpenAir | Ist vs. Plan (€), Burn Rate, EAC |
| **Zeitplan / Meilensteine** | OpenAir + Jira | Meilensteinverzug, Sprint-Velocity-Trend |
| **Ressourcenauslastung** | OpenAir | Auslastung % pro Rolle, Überbuching-Risiko |
| **Scope / Änderungsrate** | Jira | Story-Point-Delta, offene Change Requests, Bug-Rate |

Ein übergeordneter **Stabilitätsindex** (Ampel: grün / gelb / rot) aggregiert die vier Dimensionen nach konfigurierbaren Schwellenwerten.

---

## Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| UI-Komponenten | shadcn/ui, Tailwind CSS |
| Diagramme | Recharts |
| Backend / DB | Supabase (PostgreSQL, Row Level Security) |
| Auth | Supabase Auth (Email/Passwort) |
| Import | Server-side Excel-Parser (xlsx-Bibliothek) via Next.js API Routes |
| Deployment | Docker Container (interner Server / Intranet) |

---

## Import-Schnittstellen

### Jira Excel-Export
- Format: Standard-Jira-Excel-Export (Issues, Sprints, Epics)
- Relevante Felder: Issue Key, Summary, Issue Type, Status, Story Points, Sprint, Epic, Assignee, Created, Updated, Resolved
- Mapping: → `jira_issues`, `jira_sprints` Tabellen in Supabase

### OpenAir Excel-Export
- Format: NetSuite OpenAir Projektbericht-Export
- Relevante Felder: Projekt, Phase, Mitarbeiter, Rolle, geplante Stunden, gebuchte Stunden, Budget, Ist-Kosten, Meilensteine
- Mapping: → `oa_timesheets`, `oa_projects`, `oa_milestones` Tabellen in Supabase

> Import ist manuell (Upload via UI), kein automatischer Sync im MVP.

---

## Funktionsumfang MVP

### Muss (MVP)
- [ ] Authentifizierung (Login/Logout via Supabase Auth)
- [ ] Projektverwaltung (Projekt anlegen, Stammdaten pflegen)
- [ ] Import: Jira Excel-Export verarbeiten und speichern
- [ ] Import: OpenAir Excel-Export verarbeiten und speichern
- [ ] Import-Log (Datum, Dateiname, Status, Fehler)
- [ ] Dashboard: Übersicht aller Projekte mit Stabilitätsampel
- [ ] Dashboard: Projektdetail mit den vier Stabilitätsdimensionen
- [ ] Schwellenwerte für Ampellogik konfigurierbar (pro Projekt)

### Soll (Phase 2)
- [ ] Rollenkonzept (PO, Programm Manager, Consultant)
- [ ] Rollenbasierte Dashboard-Views
- [ ] Historisierung von Importen (Zeitreihen, Trending)
- [ ] E-Mail-Benachrichtigungen bei Schwellenwertüberschreitung
- [ ] Export von Dashboard-Reports als PDF

### Kann (Phase 3)
- [ ] Direktanbindung Jira API (statt Excel-Export)
- [ ] Direktanbindung OpenAir API
- [ ] Kommentarfunktion pro Projekt
- [ ] Mehrsprachigkeit (DE/EN)

---

## Nicht im Scope

- Keine eigene Zeiterfassung
- Keine Aufgabenverwaltung / Ticketsystem
- Kein öffentlicher Zugang
- Keine mobile App (Responsive Web ist ausreichend)

---

## Qualitätsanforderungen

- Ladezeit Dashboard < 2 Sekunden (bei bis zu 5 Projekten)
- Import von Excel-Dateien bis 10 MB
- Browser-Support: Chrome, Firefox, Edge (aktuell)
- DSGVO: keine personenbezogenen Daten außer Name/E-Mail der Nutzer
