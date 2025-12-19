# Workflow Scope - Iteration 2

**Projekt:** energiavital.de Produkttext-Migration  
**Version:** Iteration 2  
**Stand:** 19. Dezember 2024  
**Status:** Produktiv

---

## Zusammenfassung

Der Workflow transformiert bestehende Produkttexte aus dem Shopware-System in ein standardisiertes, LMIV-konformes Format. Der Fokus liegt auf **Umstrukturierung**, nicht auf kreativer Neuschreibung.

---

## Kernprinzip

> **Originaltext-Treue vor Optimierung**
> 
> Der Workflow strukturiert vorhandene Inhalte um, fügt aber KEINE neuen Inhalte hinzu. Dies ist eine firmeninterne Konvention ohne Ausnahmen.

---

## Was der Workflow KANN

### 1. Textumstrukturierung
- Vorhandenen Produkttext in definierte Template-Struktur einpassen
- Gliederung nach energiavital-Standard (Teaser → Badges → Beschreibung → Tabelle → Hinweise)
- Responsive HTML-Ausgabe für Desktop und Mobile

### 2. Health Claims Handling
- Vorhandene Health Claims erkennen und in EFSA-Wortlaut umwandeln
- Claims in Wirkung-Box verschieben (aufklappbar)
- Claims zählen und dokumentieren (Original vs. Neu)

### 3. Compliance-Entschärfung
- Krankheitsnamen erkennen und entschärfen
- Heilversprechen in neutrale Formulierungen umwandeln
- Nicht-autorisierte Claims markieren

### 4. Tabellen-Übernahme
- Nährwerttabellen 1:1 übernehmen
- Responsive Darstellung (Desktop: Tabelle, Mobile: Cards)
- Alle Zeilen und Werte beibehalten

### 5. SEO-Felder generieren
- Meta-Title (max. 60 Zeichen)
- Meta-Description (max. 155 Zeichen)
- Keywords (kommasepariert)
- Short-Description (max. 160 Zeichen)

### 6. Qualitätsprüfung (Validator)
- Inhaltstreue prüfen (hinzugefügt/weggelassen)
- Health Claims zählen und vergleichen
- Tabellen-Vollständigkeit prüfen
- Warnhinweise-Übernahme prüfen
- Ampel-Bewertung (GRÜN/GELB/ROT)

### 7. Human-in-the-Loop Review
- Review-Interface für manuelle Prüfung
- Nebeneinander-Ansicht (Alt/Neu)
- Compliance-Protokoll mit Details
- Freigabe/Überarbeitung-Workflow
- Status-Tracking in Airtable

---

## Was der Workflow NICHT KANN

### 1. Inhaltliche Erweiterungen
- ❌ Neue Health Claims hinzufügen (auch keine EFSA-konformen!)
- ❌ Neue Zielgruppen erfinden
- ❌ Tradition/Geschichte ergänzen
- ❌ USPs hinzufügen, die nicht im Original stehen

### 2. Kreative Neuschreibung
- ❌ Emotionales Storytelling
- ❌ Marketing-Ausschmückungen
- ❌ Lifestyle-Sprache hinzufügen
- ❌ "KI-typische" Formulierungen

### 3. Datenänderungen
- ❌ Tabellenwerte ändern oder zusammenfassen
- ❌ Dosierungen anpassen
- ❌ Inhaltsstoffe umbenennen oder gruppieren
- ❌ "k.A." für vorhandene Werte eintragen

### 4. Rechtliche Bewertung
- ❌ Entscheiden ob etwas Fair Use ist
- ❌ Rechtsverbindliche Compliance-Aussagen treffen
- ❌ EFSA-Status von Claims final bewerten

### 5. Automatische Freigabe
- ❌ Texte ohne menschliche Prüfung live schalten
- ❌ Shopware-Upload ohne Review

---

## Systemarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        AIRTABLE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Alter Text  │  │ Neuer Text  │  │ Compliance-Protokoll│ │
│  │ (Shopware)  │  │ (Generated) │  │ (Validator-Output)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Status    │  │   Ampel     │  │    Meta-Felder      │ │
│  │ (Workflow)  │  │ (GRÜN/GELB) │  │  (Title, Desc, KW)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      N8N WORKFLOW                           │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Airtable │ -> │  TEXTER  │ -> │VALIDATOR │ -> Airtable │
│  │  Trigger │    │ (Claude) │    │ (Claude) │    Update   │
│  └──────────┘    └──────────┘    └──────────┘             │
│                       │               │                    │
│                       ▼               ▼                    │
│               ┌──────────────────────────┐                │
│               │   EFSA Claims Lookup     │                │
│               │   (Airtable Reference)   │                │
│               └──────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   REVIEW INTERFACE                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ALTER TEXT  │  NEUER TEXT  │  COMPLIANCE-PROTOKOLL │   │
│  │  (Original)  │  (Preview)   │  (Ampel + Details)    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [✓ Freigeben]  [↻ Überarbeiten]  [Kommentar...]   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Status-Workflow

```
Neu erstellt
     │
     ▼
┌─────────────┐
│ Zur Prüfung │ ← Workflow hat Text generiert
└─────────────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌───────────┐    ┌─────────────┐    ┌──────────────────┐
│Freigegeben│    │Überarbeiten │    │Interner Review   │
│           │    │             │    │nötig             │
└───────────┘    └─────────────┘    └──────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────┐      Workflow erneut    Manuelle Klärung
│  Live   │      ausführen          erforderlich
└─────────┘
```

---

## Datenfelder in Airtable

### Eingabe (aus Shopware)
| Feld | Beschreibung |
|------|--------------|
| Produktnummer | SKU/Artikelnummer |
| Produktname | Produktbezeichnung |
| Alter Text | Original-Produktbeschreibung (HTML) |

### Ausgabe (vom Workflow)
| Feld | Beschreibung |
|------|--------------|
| Neuer Text | Umstrukturierter Text (HTML) |
| Meta-Title | SEO-Titel (max. 60 Zeichen) |
| Meta-Description | SEO-Beschreibung (max. 155 Zeichen) |
| Keywords | Kommaseparierte Keywords |
| Short-Description | Kurzbeschreibung (max. 160 Zeichen) |
| Compliance-Protokoll | JSON mit Prüfdetails |
| Ampel | GRÜN / GELB / ROT |

### Workflow-Steuerung
| Feld | Beschreibung |
|------|--------------|
| Status | Zur Prüfung / Freigegeben / Überarbeiten / Live / Interner Review nötig |
| Geprüft von | Name des Prüfers |
| Geprüft am | Zeitstempel der Prüfung |
| Prüfer-Kommentar | Optionaler Kommentar |

---

## Compliance-Regeln

### LMIV-Pflichtangaben
- Verzehrempfehlung mit Tagesdosis
- "Die empfohlene tägliche Verzehrmenge darf nicht überschritten werden"
- "Nahrungsergänzungsmittel sind kein Ersatz für eine ausgewogene Ernährung"
- "Außerhalb der Reichweite von kleinen Kindern aufbewahren"
- Alterseinschränkungen (falls vorhanden)
- Allergenhinweise (falls vorhanden)

### Health Claims Verarbeitung
1. **Claim im Original vorhanden** → In EFSA-Wortlaut umwandeln und in Wirkung-Box
2. **Claim nicht im Original** → NICHT hinzufügen (auch wenn EFSA-konform!)
3. **Nicht-konformer Claim** → Entschärfen oder entfernen

### Verbotene Inhalte
- Krankheitsnamen (Arthrose, Diabetes, etc.)
- Heilversprechen ("heilt", "behandelt")
- Medikamentenvergleiche
- Nicht-autorisierte Claims

---

## Qualitätskriterien

### GRÜN - Zur Freigabe empfohlen
- Alle Inhalte korrekt übernommen
- Health Claims korrekt verarbeitet
- Tabelle vollständig
- Keine Compliance-Verstöße

### GELB - Prüfung empfohlen
- Geringfügige Abweichungen
- Unklare Claim-Situation
- Formatierungsfragen

### ROT - Überarbeitung erforderlich
- Health Claims hinzugefügt
- Wichtige Inhalte fehlen
- Tabellendaten verändert
- Compliance-Verstöße nicht behoben

---

## Dateien & Komponenten

### Prompts
- `Iter_2-prompt-system-texter.txt` - System-Prompt für Textgenerierung
- `Iter_2-prompt-user-texter.txt` - User-Prompt Template
- `Iter_2-prompt-system-validator.txt` - System-Prompt für Validierung
- `Iter_2-prompt-user-validator.txt` - User-Prompt Template

### CSS
- `erweiterungen-produktseite-optimiert.css` - Basis-Komponenten
- `product-table-responsive-v2_3.css` - Responsive Tabellen
- `produktseite-typografie.css` - Typografie & Silbentrennung
- `accordion-content-styles.css` - Accordion-Inhalte

### Interface
- `review-interface.html` - Vollständiges Review-Tool

### Referenzdaten
- EFSA Health Claims in Airtable (separate Base)

---

## Bekannte Einschränkungen

1. **Keine Bild-Verarbeitung** - Produktbilder werden nicht verarbeitet
2. **Keine automatische Kategorisierung** - Produktkategorien bleiben unverändert
3. **Kein direkter Shopware-Upload** - Export/Import manuell
4. **Einzelverarbeitung** - Kein Batch-Processing im Review
5. **Deutsche Sprache only** - Keine Mehrsprachigkeit

---

## Nächste Ausbaustufen (Out of Scope für Iter 2)

- [ ] Batch-Freigabe für mehrere Artikel
- [ ] Direkter Shopware-API-Upload
- [ ] Automatische Bildoptimierung
- [ ] A/B-Testing für Produkttexte
- [ ] Mehrsprachige Generierung
- [ ] Erweitertes Reporting/Analytics

---

## Kontakt & Support

Bei Fragen zum Workflow:
- Review-Interface: "Hilfe" und "Prüfkriterien" Buttons
- Airtable: Direkte Bearbeitung der Datensätze
- n8n: Workflow-Logs für Debugging
