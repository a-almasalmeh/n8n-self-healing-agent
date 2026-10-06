package de.workflow.n8nHealingAgent.controller;

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
    public ResponseEntity<Map<String, String>> receiveN8nError(@RequestBody Map<String, Object> n8nError){

        System.out.println("The error was " + n8nError);
        return ResponseEntity.ok(Map.of("status","ok","message","request was successfully"));
    }
}
