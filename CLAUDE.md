# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bachelor's thesis prototype: an n8n "self-healing agent". When an n8n workflow fails, an n8n Error Workflow POSTs the error plus the full workflow JSON to a Spring Boot backend. The backend asks Claude to return a repaired workflow JSON, and a human approves or rejects the suggestion in a React dashboard (human-in-the-loop). Repairs are never applied to n8n automatically. Approving or rejecting only changes the incident status.

Code identifiers are English, but the LLM prompt, log output, README and commit context are partly German. Keep the prompt in German unless asked otherwise. `latex/` (untracked) holds thesis chapter drafts, not code.

## Commands

Backend (Java 17, Spring Boot 4, Maven wrapper). **Run from the repo root**, because the API key file is imported through a relative path:

```bash
./mvnw spring-boot:run                 # start backend on :8080
./mvnw test                            # run tests
./mvnw test -Dtest=N8nHealingAgentApplicationTests#contextLoads   # single test
./mvnw package                         # build jar into target/
```

The API key lives in `src/main/resources/application-local.properties` (`anthropic.api.key=sk-ant-...`, gitignored). `application.properties` loads it with `spring.config.import=optional:file:...`. If the key is missing, `LlmService` cannot resolve `${anthropic.api.key}`, so both startup and the `@SpringBootTest` context test fail.

Frontend (`frontend/`, React 19 + Vite + Tailwind 4 + TypeScript):

```bash
cd frontend
npm install
npm run dev      # dashboard on :5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

n8n locally: `docker compose up -d` (container `n8n-prototype`, port 5678). From inside Docker, n8n reaches the backend at `host.docker.internal:8080`.

To test the whole flow without n8n, POST a payload to `http://localhost:8080/api/webhook/error`. The README (section "Schritt 6") has a ready-made `curl` example.

## Architecture

Request flow: `WebhookController` (`/api/webhook`) → `LlmService` → Anthropic API → `HealingIncident` stored in memory → dashboard polls it.

- **`WebhookController`**: all REST endpoints (`POST /error`, `GET /incidents`, `POST /incidents/{id}/approve|reject`). Incidents are held in a `CopyOnWriteArrayList` field on the controller. There is no database, so everything is lost on restart. `POST /error` is synchronous and blocks until Claude responds. CORS is open (`*`).
- **Study instrumentation**: `/error` records the arrival time and the LLM call duration on the incident. On `APPROVED`, the controller sets `resolvedTime` and appends a line to `studien_ergebnisse.csv`, resolved relative to the working directory, with columns `id;failed_node;status;llm_duration_ms;total_duration_ms`. These numbers feed the thesis evaluation, so keep the CSV format stable.
- **`LlmService`**: builds a single German prompt (failed node, error message, full workflow JSON) and calls the Anthropic Java SDK (`anthropic-java`) with a hard-coded model (`Model.CLAUDE_OPUS_5_5`), `maxTokens(16000)` and effort `HIGH`. It concatenates only the text blocks, strips any surrounding ```` ``` ```` fence, and parses the result into `Map<String, Object>`. It does not throw on failure. Instead it returns `{"error": ...}`, either for a `max_tokens` cutoff or for any exception, and that map is stored as the "repaired" workflow.
- **Prompt invariants**: Claude must copy the JSON 1:1, keeping `credentials`, `webhookId`, `staticData`, `shared`, `settings` and `meta`. It must also leave the nested-array structure of `connections` unchanged, keep data types, and fix only the failing node and its sub-nodes. Review dashboards diff the original against the repair, so unrelated changes show up as noise.
- **Models**: `N8nWebhookPayload` (incoming) and `HealingIncident` (payload + repair + status `PENDING|APPROVED|REJECTED` + timing fields) use snake_case field names on purpose, because they are serialized straight to and from JSON. Jackson 3 is used (`tools.jackson.*` packages, not `com.fasterxml`).
- **Frontend**: `App.tsx` has a hard-coded `API_BASE = 'http://localhost:8080/api/webhook'` and polls `/incidents` every 5 s. It provides list filters and approve/reject. `DiffView.tsx` and `jsonDiff.ts` render a side-by-side, line-based diff (npm `diff`) of the original versus the repaired workflow JSON, with unchanged context collapsed.
