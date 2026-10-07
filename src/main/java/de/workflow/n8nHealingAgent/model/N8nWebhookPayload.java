package de.workflow.n8nHealingAgent.model;

import java.util.Map;

public class N8nWebhookPayload {
    private final String workflow_id;
    private final String failed_node;
    private final String error_message;
    private final Map<String, Object> workflow;

    public N8nWebhookPayload(String workflow_id, String failed_node, String error_message, Map<String, Object> workflow) {
        this.workflow_id = workflow_id;
        this.failed_node = failed_node;
        this.error_message = error_message;
        this.workflow = workflow;
    }

    public String getWorkflow_id() {
        return workflow_id;
    }

    public String getFailed_node() {
        return failed_node;
    }

    public String getError_message() {
        return error_message;
    }

    public Map<String, Object> getWorkflow() {
        return workflow;
    }
}
