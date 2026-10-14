package de.workflow.n8nHealingAgent.controller;

import de.workflow.n8nHealingAgent.model.N8nWebhookPayload;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/webhook")
public class WebhookController {

    @PostMapping("/error")
    public ResponseEntity<Map<String, String>> receiveN8nError(@RequestBody N8nWebhookPayload n8nError){

        System.out.println("Workflow ID " + n8nError.getWorkflow_id());
        System.out.println("Fehler in Knoten " + n8nError.getFailed_node());
        System.out.println("Fehlermeldung " + n8nError.getError_message());
        System.out.println(n8nError.getWorkflow().toString());

        return ResponseEntity.ok(Map.of("status","ok","message","request was successfully"));
    }
}
