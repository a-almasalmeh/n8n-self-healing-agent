package de.workflow.n8nHealingAgent.model;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class HealingIncident {
    private final String id;
    private final Instant timestamp;
    private final String workflow_id;
    private final String workflow_name;
    private final String failed_node;
    private final String error_message;
    private final Map<String, Object> original_workflow_json;
    private final Map<String, Object> repaired_workflow_json;
    private volatile String status;

    public HealingIncident(N8nWebhookPayload payload, Map<String, Object> repaired_workflow_json) {
        this.id = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
        this.workflow_id = payload.getWorkflow_id();
        this.workflow_name = extractWorkflowName(payload.getWorkflow());
        this.failed_node = payload.getFailed_node();
        this.error_message = payload.getError_message();
        this.original_workflow_json = payload.getWorkflow();
        this.repaired_workflow_json = repaired_workflow_json;
        this.status = "PENDING";
    }

    public String getId() {
        return id;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public String getWorkflow_id() {
        return workflow_id;
    }

    public String getWorkflow_name() {
        return workflow_name;
    }

    public String getFailed_node() {
        return failed_node;
    }

    public String getError_message() {
        return error_message;
    }

    public Map<String, Object> getOriginal_workflow_json() {
        return original_workflow_json;
    }

    public Map<String, Object> getRepaired_workflow_json() {
        return repaired_workflow_json;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    private static String extractWorkflowName(Map<String, Object> workflow) {
        if (workflow != null && workflow.get("name") instanceof String name && !name.isBlank()) {
            return name;
        }
        return "Unbenannter Workflow";
    }
}
