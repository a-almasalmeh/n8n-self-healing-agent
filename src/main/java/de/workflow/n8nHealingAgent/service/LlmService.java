package de.workflow.n8nHealingAgent.service;

import de.workflow.n8nHealingAgent.model.N8nWebhookPayload;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

@Service
public class LlmService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public LlmService (ObjectMapper objectMapper){
        this.restClient = RestClient.create("http://localhost:11434");
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> analyzeAndRepairWorkflow (N8nWebhookPayload payload){

        try {


        String failedNode = payload.getFailed_node();
        String errorMessage = payload.getError_message();
        String workflowJson = objectMapper.writeValueAsString(payload.getWorkflow());

        String Prompt = String.format("""
               Du bist ein präziser JSON-Reparatur-Agent für n8n-Workflows.
               Deine Aufgabe ist es, den Fehler in der fehlerhaften Node zu beheben und das vollständige Workflow-JSON zurückzugeben.
                DEINE AUFGABEN:
                                1. Kopiere das gesamte JSON 1:1. Lösche KEINE Schlüssel oder Objekte (behalt zwingend alle "credentials", "webhookId", "staticData", "shared", "settings" und "meta" exakt bei!).
                                2. Verändere NICHT die Struktur von "connections" (doppelte eckige Klammern [[ ... ]] müssen exakt so bleiben!).
                                3. Behalte alle Datentypen (boolean, null, Zahlen, Arrays) exakt wie im Original bei.
                                4. Suche in der Liste "nodes" nach der Ursache für die Fehlermeldung (prüfe die Node "%s" UND alle mit ihr verbundenen Sub-Nodes, um folgenden Fehler zu beheben: "%s".
                
                                ORIGINAL WORKFLOW JSON:
                                %s
                
                                """,failedNode, errorMessage, workflowJson);


        Map<String, Object> ollamaRequest = Map.of(
                "model", "llama3.2",
                "prompt", Prompt,
                "stream", false,
                "format", "json"
        );
        Map response = restClient.post()
                .uri("api/generate")
                .body(ollamaRequest)
                .retrieve()
                .body(Map.class);

        if (response!=null && response.containsKey("response")){
            String rawJsonFromLlm = (String) response.get("response");

             return objectMapper.readValue(rawJsonFromLlm, new TypeReference<Map<String, Object>>() {});
        }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return Map.of("error", "Fehler bei der KI-Verarbeitung");
    }
}
