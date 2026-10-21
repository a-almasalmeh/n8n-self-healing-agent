# n8n Self-Healing Agent

**KI-gestützte, automatisierte Fehlerbehebung von n8n-Workflows mit Human-in-the-Loop-Freigabe**


---

## Motivation

Low-Code-/No-Code-Plattformen wie [n8n](https://n8n.io) ermöglichen es auch Nutzern ohne tiefe Programmierkenntnisse, Geschäftsprozesse zu automatisieren. Die so entstehenden Workflows sind jedoch fehleranfällig: Ändert sich ein Datenformat, fällt eine API aus oder werden Zugriffslimits überschritten, bricht der Workflow ab – und ein Entwickler muss den Fehler manuell beheben.

Dieses Projekt untersucht, wie ein **lokal betriebenes Large Language Model (LLM)** fehlgeschlagene Workflows analysieren und einen Reparaturvorschlag erzeugen kann. Da KI-basierte Änderungen selbst fehleranfällig sind, werden sie **nicht automatisch angewendet**: Ein Mensch prüft jeden Vorschlag in einem Review-Dashboard und gibt ihn frei oder verwirft ihn.

---

## Inhaltsverzeichnis

1. [Systemarchitektur & Ablauf](#1-systemarchitektur--ablauf)
2. [Tech-Stack](#2-tech-stack)
3. [Voraussetzungen & Installation](#3-voraussetzungen--installation)
4. [API-Endpunkte im Überblick](#4-api-endpunkte-im-überblick)
5. [Projektstruktur](#5-projektstruktur)
6. [Aktueller Stand & Einschränkungen](#6-aktueller-stand--einschränkungen)

---

## 1. Systemarchitektur & Ablauf

```
┌──────────────────────┐      HTTP POST       ┌────────────────────────────┐
│        n8n           │  /api/webhook/error  │    Spring Boot Backend     │
│                      │ ───────────────────▶ │        (Port 8080)         │
│  Workflow schlägt    │                      │                            │
│  fehl → Error Trigger│                      │  WebhookController         │
│  → HTTP Request      │                      │        │                   │
│  (→ Telegram, opt.)  │                      │        │                   │
└──────────────────────┘                      │        ▼                   │
                                              │  LlmService ───────────────┼──┐
                                              │        │                   │  │ POST /api/generate
                                              │        ▼                   │  │
                                              │  HealingIncident (PENDING) │  ▼
                                              │  In-Memory-Speicher        │ ┌───────────────────┐
                                              └────────────▲───────────────┘ │  Ollama (lokal)   │
                                                           │                 │  Llama 3.2        │
                                         GET /incidents    │                 │  Port 11434       │
                                         POST …/approve    │                 └───────────────────┘
                                         POST …/reject     │
                                              ┌────────────┴───────────────┐
                                              │   React Review-Dashboard   │
                                              │   (Vite, Port 5173)        │
                                              │   Human-in-the-Loop        │
                                              └────────────────────────────┘
```

### Ablauf im Detail

1. **Fehler in n8n (Error Trigger)**
   Ein überwachter n8n-Workflow bricht zur Laufzeit ab. In seinen Workflow-Einstellungen ist ein separater *Error Workflow* hinterlegt, der mit einem **Error Trigger**-Node startet. Dieser Error Workflow sammelt die Fehlerinformationen (ID des Workflows, fehlgeschlagener Node, Fehlermeldung) sowie das vollständige Workflow-JSON (z. B. über den n8n-Node bzw. die n8n-API „Get Workflow“) und sendet sie per **HTTP Request**-Node an das Backend.

2. **Spring Boot Webhook**
   Der `WebhookController` nimmt den Fehler unter `POST /api/webhook/error` entgegen und übergibt ihn an den `LlmService`.

3. **Lokales LLM via Ollama**
   Der `LlmService` baut einen strukturierten Prompt aus fehlerhaftem Node, Fehlermeldung und Original-Workflow-JSON. Der Prompt weist das Modell an,
   - das komplette JSON 1:1 zu übernehmen (inkl. `credentials`, `webhookId`, `staticData`, `settings`, `meta` …),
   - die Struktur von `connections` nicht zu verändern,
   - alle Datentypen beizubehalten und
   - nur die Ursache im betroffenen Node bzw. in verbundenen Sub-Nodes zu beheben.

   Die Anfrage geht an die lokale Ollama-Instanz (`http://localhost:11434/api/generate`, Modell `llama3.2`, `format: "json"`). Es verlassen also **keine Workflow-Daten den eigenen Rechner**.

4. **Human-in-the-Loop React-Dashboard**
   Aus Fehler und Reparaturvorschlag wird ein `HealingIncident` mit Status `PENDING` erzeugt. Das Dashboard fragt die Incidents alle 5 Sekunden ab und zeigt:
   - eine Incident-Liste mit Filtern (*Alle* / *Pending* / *Bearbeitet*),
   - Workflow-Name, fehlgeschlagenen Node und Fehlermeldung,
   - eine **Side-by-Side-JSON-Diff-Ansicht** zwischen Original- und repariertem Workflow.

   Der Nutzer kann den Vorschlag **freigeben** (`APPROVED`) oder **verwerfen** (`REJECTED`).

---

## 2. Tech-Stack

| Bereich | Technologie | Zweck |
|---|---|---|
| Backend | **Java 17**, **Spring Boot** (Spring Web MVC, `RestClient`, Jackson) | Webhook-Empfang, LLM-Anbindung, REST-API |
| Build (Backend) | Maven (Wrapper `./mvnw` enthalten) | Build & Start |
| LLM | **Ollama** mit **Llama 3.2** | Lokale Fehleranalyse & Generierung des reparierten Workflow-JSONs |
| Frontend | **React** + TypeScript | Human-in-the-Loop Review-Dashboard |
| Build (Frontend) | **Vite** | Dev-Server & Bundling |
| Styling | **Tailwind CSS**, lucide-react (Icons) | UI |
| Diff | `diff` (npm) | Zeilenweiser Vergleich Original ↔ Reparatur |
| Workflow-Plattform | **n8n** | Simulation fehleranfälliger Geschäftsprozesse, Error Trigger |
| Infrastruktur | **Docker**, Docker Compose | Lokaler Betrieb von n8n (und optional Ollama) |

---

## 3. Voraussetzungen & Installation

### Voraussetzungen

| Software | Version | Prüfen mit |
|---|---|---|
| Java JDK | 17 oder neuer | `java -version` |
| Node.js | 20.19+ bzw. 22.12+ (von Vite vorausgesetzt) | `node -v` |
| npm | wird mit Node.js installiert | `npm -v` |
| Ollama | aktuelle Version | `ollama --version` |
| Docker inkl. Compose | aktuelle Version (für n8n) | `docker compose version` |

Maven muss nicht separat installiert sein – das Projekt bringt den Maven Wrapper (`mvnw`) mit.

### Schritt 1: Repository klonen

```bash
git clone https://github.com/a-almasalmeh/n8n-self-healing-agent.git
cd n8n-self-healing-agent
```

### Schritt 2: Ollama installieren und Llama 3.2 starten

1. Ollama installieren: <https://ollama.com/download>
   (macOS alternativ: `brew install ollama`)
2. Ollama-Server starten (falls nicht bereits als App im Hintergrund aktiv):
   ```bash
   ollama serve
   ```
3. Modell herunterladen:
   ```bash
   ollama pull llama3.2
   ```
4. Erreichbarkeit prüfen:
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Die Antwort sollte `llama3.2` in der Modellliste enthalten.

> **Alternative mit Docker:**
> ```bash
> docker run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama ollama/ollama
> docker exec -it ollama ollama pull llama3.2
> ```

### Schritt 3: n8n mit Docker Compose starten

Im Hauptverzeichnis liegt eine `docker-compose.yml`, die n8n als Container `n8n-prototype` startet (Port `5678`, Zeitzone `Europe/Berlin`, persistente Daten im Volume `n8n_data`):

```bash
docker compose up -d
```

Anschließend ist n8n unter <http://localhost:5678> erreichbar. Stoppen mit `docker compose down` (die Workflows bleiben im Volume erhalten).

**Error Workflow einrichten:**

1. Neuen Workflow anlegen, der mit einem **Error Trigger**-Node beginnt.
2. Das vollständige Workflow-JSON des fehlgeschlagenen Workflows laden (z. B. mit dem **n8n**-Node → *Workflow* → *Get*, ID aus `{{ $json.workflow.id }}`).
3. Einen **HTTP Request**-Node anhängen:
   - Methode: `POST`
   - URL: `http://host.docker.internal:8080/api/webhook/error`
     (n8n läuft im Container, das Backend auf dem Host)
   - Body (JSON), z. B.:
     ```json
     {
       "workflow_id": "{{ $('Error Trigger').item.json.workflow.id }}",
       "failed_node": "{{ $('Error Trigger').item.json.execution.lastNodeExecuted }}",
       "error_message": "{{ $('Error Trigger').item.json.execution.error.message }}",
       "workflow": {{ JSON.stringify($json) }}
     }
     ```
4. *Optional:* Am Ende einen Benachrichtigungs-Node anhängen, z. B. **Telegram** → *Send Message*, um bei jedem neuen Incident informiert zu werden und ihn im Dashboard zu prüfen.
5. Im zu überwachenden Workflow unter *Settings → Error Workflow* diesen Error Workflow auswählen.

> **Hinweis:** `host.docker.internal` funktioniert unter Docker Desktop (macOS/Windows) direkt. Unter Linux muss dem n8n-Service in der `docker-compose.yml` zusätzlich `extra_hosts: ["host.docker.internal:host-gateway"]` hinzugefügt werden.

### Schritt 4: Backend starten (Spring Boot)

Im Hauptverzeichnis des Repositorys:

```bash
./mvnw spring-boot:run
```

Unter Windows:

```bat
mvnw.cmd spring-boot:run
```

Das Backend läuft anschließend auf <http://localhost:8080>.
Schnelltest:

```bash
curl http://localhost:8080/api/webhook/incidents
# → []
```

### Schritt 5: Frontend starten (React-Dashboard)

```bash
cd frontend
npm install
npm run dev
```

Das Dashboard ist danach unter <http://localhost:5173> erreichbar. Es erwartet das Backend unter `http://localhost:8080/api/webhook` (konfiguriert in `frontend/src/App.tsx`, Konstante `API_BASE`).

### Schritt 6: Ende-zu-Ende testen (ohne n8n)

Ein Fehler-Event lässt sich auch direkt per `curl` simulieren:

```bash
curl -X POST http://localhost:8080/api/webhook/error \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "demo-123",
    "failed_node": "HTTP Request",
    "error_message": "The resource you are requesting could not be found (404)",
    "workflow": {
      "name": "Demo Workflow",
      "nodes": [
        {
          "name": "HTTP Request",
          "type": "n8n-nodes-base.httpRequest",
          "parameters": { "url": "https://api.example.com/v1/userz" }
        }
      ],
      "connections": {}
    }
  }'
```

Nach der Antwort des LLM erscheint der Incident im Dashboard mit Status **Pending** und kann dort geprüft, freigegeben oder verworfen werden.

---

## 4. API-Endpunkte im Überblick

Basis-URL: `http://localhost:8080/api/webhook` (CORS für alle Origins freigegeben)

| Methode | Pfad | Beschreibung | Antwort |
|---|---|---|---|
| `POST` | `/error` | Nimmt einen Workflow-Fehler aus n8n entgegen, lässt das LLM einen Reparaturvorschlag erzeugen und legt einen Incident mit Status `PENDING` an. | `200` – repariertes Workflow-JSON |
| `GET` | `/incidents` | Liefert alle bisher erfassten Incidents. | `200` – Liste von `HealingIncident` |
| `POST` | `/incidents/{id}/approve` | Gibt den Reparaturvorschlag frei (Status → `APPROVED`). | `200` – aktualisierter Incident · `404` – ID unbekannt |
| `POST` | `/incidents/{id}/reject` | Verwirft den Reparaturvorschlag (Status → `REJECTED`). | `200` – aktualisierter Incident · `404` – ID unbekannt |

### Request-Body `POST /error`

```json
{
  "workflow_id": "string",
  "failed_node": "string",
  "error_message": "string",
  "workflow": { "...": "vollständiges n8n-Workflow-JSON" }
}
```

Schlägt die Verarbeitung durch das LLM fehl, lautet die Antwort `{"error": "Fehler bei der KI-Verarbeitung"}`.

### Datenmodell `HealingIncident`

```json
{
  "id": "UUID",
  "timestamp": "2026-10-21T08:00:00Z",
  "workflow_id": "string",
  "workflow_name": "string (Fallback: \"Unbenannter Workflow\")",
  "failed_node": "string",
  "error_message": "string",
  "original_workflow_json": { },
  "repaired_workflow_json": { },
  "status": "PENDING | APPROVED | REJECTED"
}
```

---

## 5. Projektstruktur

```
n8n-self-healing-agent/
├── docker-compose.yml              # Lokale n8n-Instanz
├── pom.xml                         # Maven-Konfiguration (Spring Boot, Java 17)
├── mvnw / mvnw.cmd                 # Maven Wrapper
├── src/main/java/de/workflow/n8nHealingAgent/
│   ├── N8nHealingAgentApplication.java
│   ├── controller/
│   │   └── WebhookController.java  # REST-Endpunkte, In-Memory-Incident-Speicher
│   ├── model/
│   │   ├── N8nWebhookPayload.java  # Eingehender Fehler aus n8n
│   │   └── HealingIncident.java    # Fehler + Reparaturvorschlag + Status
│   └── service/
│       └── LlmService.java         # Prompt-Erstellung & Anbindung an Ollama
├── src/main/resources/
│   └── application.properties
└── frontend/                       # React-Dashboard (Vite + Tailwind CSS)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                 # Incident-Liste, Filter, Approve/Reject
        ├── DiffView.tsx            # Diff-Ansicht Original ↔ Reparatur (eingeklappter Kontext)
        └── jsonDiff.ts             # Zeilenweiser Side-by-Side-JSON-Diff
```

---

## 6. Aktueller Stand & Einschränkungen


- **In-Memory-Speicherung:** Incidents werden nur im Arbeitsspeicher gehalten und gehen beim Neustart des Backends verloren.
- **Feste Konfiguration:** Ollama-URL (`http://localhost:11434`), Modell (`llama3.2`) und Backend-URL im Frontend sind im Code hinterlegt.
- **Synchrone Verarbeitung:** Der Aufruf von `POST /error` blockiert, bis das LLM geantwortet hat.
- **Keine Authentifizierung:** Die API ist für den lokalen Testbetrieb gedacht und ungeschützt.
