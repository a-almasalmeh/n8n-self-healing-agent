package de.workflow.n8nHealingAgent.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import de.workflow.n8nHealingAgent.model.N8nWebhookPayload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LlmService {

    private final AnthropicClient anthropicClient;
    private final ObjectMapper objectMapper;

    public LlmService (ObjectMapper objectMapper, @Value("${anthropic.api.key}") String apiKey){
        this.anthropicClient = AnthropicOkHttpClient.builder()
                .apiKey(apiKey)
                .build();
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> analyzeAndRepairWorkflow (N8nWebhookPayload payload){

        try {


        String failedNode = payload.getFailed_node();
        String errorMessage = payload.getError_message();
        String workflowJson = objectMapper.writeValueAsString(payload.getWorkflow());

        String prompt = String.format("""
               Du bist ein präziser JSON-Reparatur-Agent für n8n-Workflows.
               Deine Aufgabe ist es, den Fehler in der fehlerhaften Node zu beheben und das vollständige Workflow-JSON zurückzugeben.
                DEINE AUFGABEN:
                                1. Kopiere das gesamte JSON 1:1. Lösche KEINE Schlüssel oder Objekte (behalt zwingend alle "credentials", "webhookId", "staticData", "shared", "settings" und "meta" exakt bei!).
                                2. Verändere NICHT die Struktur von "connections" (doppelte eckige Klammern [[ ... ]] müssen exakt so bleiben!).
                                3. Behalte alle Datentypen (boolean, null, Zahlen, Arrays) exakt wie im Original bei.
                                4. Suche in der Liste "nodes" nach der Ursache für die Fehlermeldung (prüfe die Node "%s" UND alle mit ihr verbundenen Sub-Nodes, um folgenden Fehler zu beheben: "%s".
                                5. Antworte ausschließlich mit dem vollständigen JSON-Objekt, ohne Erklärungen und ohne Markdown-Codeblöcke.
                
                                ORIGINAL WORKFLOW JSON:
                                %s
                
                                """,failedNode, errorMessage, workflowJson);


            MessageCreateParams params = MessageCreateParams.builder()
                    .model(Model.CLAUDE_OPUS_5_5)
                    .maxTokens(16000)
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.HIGH).build())
                    .addUserMessage(prompt)
                    .build();


            Message message = anthropicClient.messages().create(params);

            if (message.stopReason().filter(StopReason.MAX_TOKENS::equals).isPresent()) {
                return Map.of("error", "Antwort der KI wurde abgeschnitten (max_tokens erreicht)");
            }

            // Thinking-Blöcke überspringen, nur die Textblöcke enthalten das JSON
            String rawJsonFromClaude = message.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(TextBlock::text)
                    .collect(Collectors.joining())
                    .strip();

            // Falls die Antwort trotzdem in einen ```json-Block verpackt ist
            if (rawJsonFromClaude.startsWith("```")) {
                rawJsonFromClaude = rawJsonFromClaude
                        .replaceFirst("^```(?:json)?\\s*", "")
                        .replaceFirst("\\s*```$", "");
            }

            if (!rawJsonFromClaude.isEmpty()) {
                return objectMapper.readValue(rawJsonFromClaude, new TypeReference<Map<String, Object>>() {});
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return Map.of("error", "Fehler bei der KI-Verarbeitung");
    }
}
