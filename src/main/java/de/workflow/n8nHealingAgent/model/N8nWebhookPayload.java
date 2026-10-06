package de.workflow.n8nHealingAgent.model;

import java.util.Map;

public class N8nWebhookPayload {
    private final String WorkflowId;
    private final String failedNode;
    private final String errorMessage;
    private final Map<String, Object> Workflow;

    public N8nWebhookPayload(Map<String, Object> workflow, String errorMessage, String workflowId, String failedNode) {
        this.Workflow = workflow;
        this.errorMessage = errorMessage;
        this.WorkflowId = workflowId;
        this.failedNode = failedNode;
    }

    public String getWorkflowId() {
        return WorkflowId;
    }

    public Map<String, Object> getWorkflow() {
        return Workflow;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getFailedNode() {
        return failedNode;
    }
}
