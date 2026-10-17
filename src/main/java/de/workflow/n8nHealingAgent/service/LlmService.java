package de.workflow.n8nHealingAgent.service;

import de.workflow.n8nHealingAgent.model.N8nWebhookPayload;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
public class LlmService {

    private final RestClient restClient;

    public LlmService (){
        this.restClient = RestClient.create("http://localhost:11434");
    }

    public String analyzeAndRepairWorkflow (N8nWebhookPayload payload){

        String failedNode = payload.getFailed_node();
        String errorMessage = payload.getError_message();
        String workflowJson = payload.getWorkflow().toString();

        String Prompt = String.format("""
               Analysiere Den Fehler und repariere das JSON der Fehlerhaften Node.
                FEHLERHAFTE NODE: %s
                FEHLERMELDUNG: %s
                WORKFLOW JSON: %s
                Gib AUSSCHLIESSLICH das korrigierte Workflow-JSON zurück, ohne Markdown, ohne Erklärungen.""",failedNode, errorMessage, workflowJson);


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
            return (String) response.get("response");
        }
        return "";
    }
}
