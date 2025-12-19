# Neue Airtable-Felder für Original-Compliance

## Übersicht

Diese zwei neuen Felder dokumentieren Compliance-Probleme im **Originaltext** (nicht im generierten Text). Sie dienen als Feedback-Schleife zum Compliance-Entscheider.

---

## Feld 1: Original-Compliance-Status

| Eigenschaft | Wert |
|-------------|------|
| **Feldname** | `Original-Compliance-Status` |
| **Feldtyp** | Single Select |
| **Optionen** | `OK`, `Prüfung empfohlen`, `Kritisch` |
| **Farben** | OK = Grün, Prüfung empfohlen = Gelb, Kritisch = Rot |

### Bedeutung der Werte

| Status | Bedeutung | Beispiele |
|--------|-----------|-----------|
| **OK** | Keine Compliance-Probleme im Originaltext gefunden | Nur zugelassene Mikronährstoff-Claims |
| **Prüfung empfohlen** | Leichte/mittlere Probleme gefunden | Übertreibungen, vage Formulierungen |
| **Kritisch** | Schwere Probleme gefunden | Krankheitsnamen, Heilversprechen, Botanicals mit Wirkaussagen |

---

## Feld 2: Original-Compliance-Findings

| Eigenschaft | Wert |
|-------------|------|
| **Feldname** | `Original-Compliance-Findings` |
| **Feldtyp** | Long Text |
| **Max. Länge** | ~500 Zeichen (empfohlen) |

### Inhalt

Ein kurzer, lesbarer Report der gefundenen Probleme. Format:

```
KATEGORIE: Beschreibung des Problems ('Zitat aus Original').
KATEGORIE: Weiteres Problem.
EMPFEHLUNG: Handlungsempfehlung.
```

### Beispiel

```
BOTANICALS: Rotes Weinlaub mit Wirkaussage zu Gefäßen ('positiven Einfluss auf die Gefäße bis in die kleinsten Äderchen').
FUNKTIONALE AUSSAGEN: 'für gesunde Beine und Venen' - keine zugelassenen Claims für diese Aussage.
EMPFEHLUNG: Originaltext auf Etikett/Website prüfen, Wirkaussagen zu Botanicals entfernen oder durch Tradition-Formulierung ersetzen.
```

---

## Integration in n8n Workflow

### Airtable Field IDs

| Feld | Field ID |
|------|----------|
| `Original-Compliance-Status` | `fldPa5MMvArcEmBrn` |
| `Original-Compliance-Findings` | `fldd4r7GTcegj0ntu` |

### Validator-Output Mapping

Der Validator liefert im JSON:

```json
{
  "originalTextCompliance": {
    "status": "KRITISCH",
    "shortReport": "BOTANICALS: Rotes Weinlaub...",
    "botanicalsWithClaims": [...],
    "violations": [...]
  }
}
```

### n8n Set Node Konfiguration

```javascript
// Original-Compliance-Status
{{ $json.originalTextCompliance.status === "KRITISCH" ? "Kritisch" : 
   $json.originalTextCompliance.status === "PRÜFUNG_EMPFOHLEN" ? "Prüfung empfohlen" : "OK" }}

// Original-Compliance-Findings
{{ $json.originalTextCompliance.shortReport || "" }}
```

---

## Anzeige im Review-Interface

Die Felder werden im Compliance-Protokoll-Bereich angezeigt:

```
┌─────────────────────────────────────────────┐
│ ⚠️ ORIGINAL-COMPLIANCE: Kritisch           │
├─────────────────────────────────────────────┤
│ BOTANICALS: Rotes Weinlaub mit Wirkaussage │
│ zu Gefäßen ('positiven Einfluss...')       │
│                                             │
│ EMPFEHLUNG: Originaltext prüfen            │
└─────────────────────────────────────────────┘
```

---

## Workflow-Konsequenzen

| Original-Status | Empfohlene Aktion |
|-----------------|-------------------|
| OK | Normaler Review-Prozess |
| Prüfung empfohlen | Review mit besonderer Aufmerksamkeit |
| Kritisch | Weiterleitung an Compliance-Entscheider vor Freigabe |

---

## Abgrenzung

Diese Felder bewerten den **Originaltext**, nicht die Qualität der Umformatierung.

- `Ampel` (GRÜN/GELB/ROT) → Bewertung der Umformatierung
- `Original-Compliance-Status` → Bewertung des Originaltexts

Ein Datensatz kann haben:
- Ampel GRÜN + Original-Compliance Kritisch = Umformatierung OK, aber Originaltext problematisch
- Ampel ROT + Original-Compliance OK = Originaltext OK, aber Umformatierung fehlerhaft
