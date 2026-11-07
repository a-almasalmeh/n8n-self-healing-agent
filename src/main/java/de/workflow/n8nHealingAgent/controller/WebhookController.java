package de.workflow.n8nHealingAgent.controller;

import de.workflow.n8nHealingAgent.model.HealingIncident;
import de.workflow.n8nHealingAgent.model.N8nWebhookPayload;
import de.workflow.n8nHealingAgent.service.LlmService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/webhook")
@CrossOrigin(origins = "*")
public class WebhookController {

    private final LlmService llmService;
    private final List<HealingIncident> incidents = new CopyOnWriteArrayList<>();

    public WebhookController(LlmService llmService) {
        this.llmService = llmService;
    }

    @PostMapping("/error")
    public ResponseEntity<Map<String, Object>> receiveN8nError(@RequestBody N8nWebhookPayload n8nError){

        long errorArrivalTime = System.currentTimeMillis();

        System.out.println("Workflow ID " + n8nError.getWorkflow_id());
        System.out.println("Fehler in Knoten " + n8nError.getFailed_node());
        System.out.println("Fehlermeldung " + n8nError.getError_message());
        System.out.println(n8nError.getWorkflow().toString());

        long bevorAi = System.currentTimeMillis();
        Map<String, Object> correctWorkflow = llmService.analyzeAndRepairWorkflow(n8nError);
        long afterAi = System.currentTimeMillis();


        HealingIncident incident = new HealingIncident(n8nError, correctWorkflow);
        incident.setStartTime(errorArrivalTime);
        incident.setLlmDurationMs(afterAi - bevorAi);
        incidents.add(incident);

        return ResponseEntity.ok(correctWorkflow);
    }

    @GetMapping("/incidents")
    public List<HealingIncident> getIncidents() {
        return incidents;
    }

    @PostMapping("/incidents/{id}/approve")
    public ResponseEntity<HealingIncident> approveIncident(@PathVariable String id) {
        return updateStatus(id, "APPROVED");
    }

    @PostMapping("/incidents/{id}/reject")
    public ResponseEntity<HealingIncident> rejectIncident(@PathVariable String id) {
        return updateStatus(id, "REJECTED");
    }

    private ResponseEntity<HealingIncident> updateStatus(String id, String status) {
        return incidents.stream()
                .filter(incident -> incident.getId().equals(id))
                .findFirst()
                .map(incident -> {
                    incident.setStatus(status);
                    if ("APPROVED".equals(status)) {
                        incident.setResolvedTime(System.currentTimeMillis());
                        long totalDuration = incident.getResolvedTime() - incident.getStartTime();


                        String csvZeile = incident.getId() + ";"
                                + incident.getFailed_node() + ";"
                                + status + ";"
                                + incident.getLlmDurationMs() + ";"
                                + totalDuration + "\n";

                        try {
                            Path csv = Path.of("studien_ergebnisse.csv");
                            if(Files.notExists(csv)) {
                                Files.writeString(csv, "id;failed_node;status;llm_duration_ms;total_duration_ms\n");
                            }
                            Files.writeString(
                                    csv,
                                    csvZeile,
                                    StandardOpenOption.APPEND
                            );
                            System.out.println("STUDIEN-LOG GESPEICHERT: " + csvZeile.trim());
                        } catch (Exception e) {
                            System.out.println("Fehler beim CSV-Speichern: " + e.getMessage());
                        }
                    }

                    return ResponseEntity.ok(incident);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
