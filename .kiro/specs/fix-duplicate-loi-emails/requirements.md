# Requirements Document

## Introduction

The application currently has a duplicate email issue when sending Letters of Intent (LOI). When users send an LOI, the system incorrectly sends two emails:

1. "Lease Agreement - Richwood, Suite 2111" (incorrect - should not be sent for LOI)
2. "LOI for Suite 2111 at Richwood" (correct - this is the expected email)

This suggests there's either a duplicate email sending process or some workflow is incorrectly triggering both LOI and Lease Agreement email workflows when only the LOI email should be sent.

Based on code analysis, there are two separate email workflows:
- **LOI Email Workflow**: `LeadsController.sendLoiEmail()` → `LeadsService.sendLoiEmail()` 
- **Lease Agreement Email Workflow**: `DocuSignController.sendForSignature()` → sends lease agreement email

The issue appears to be that both workflows are being triggered when only the LOI workflow should execute.

## Glossary

- **LOI**: Letter of Intent - a document expressing intent to lease a property
- **Lease_Agreement**: A formal lease contract document sent for signature via DocuSign
- **Email_Workflow**: A sequence of operations that results in sending an email
- **Leads_Service**: The service responsible for managing leads and sending LOI emails
- **DocuSign_Service**: The service responsible for lease agreement signing and related emails
- **Duplicate_Email_Issue**: The problem where two different emails are sent when only one should be sent

## Requirements

### Requirement 1: Investigate Root Cause

**User Story:** As a developer, I want to identify the root cause of duplicate email sending, so that I can understand why both LOI and lease agreement emails are being triggered.

#### Acceptance Criteria

1. WHEN investigating the codebase, THE System SHALL identify all code paths that can trigger LOI email sending
2. WHEN investigating the codebase, THE System SHALL identify all code paths that can trigger lease agreement email sending  
3. WHEN analyzing the email workflows, THE System SHALL determine if there are shared triggers between LOI and lease agreement emails
4. WHEN examining the frontend or API calls, THE System SHALL identify if multiple endpoints are being called simultaneously
5. WHEN reviewing the leads controller and service, THE System SHALL verify the LOI email sending implementation is correct

### Requirement 2: Identify Duplicate Logic

**User Story:** As a developer, I want to locate the specific code causing duplicate emails, so that I can fix the issue precisely.

#### Acceptance Criteria

1. WHEN examining the LOI sending workflow, THE System SHALL verify that `LeadsService.sendLoiEmail()` only sends LOI emails
2. WHEN examining the lease agreement workflow, THE System SHALL verify that `DocuSignController.sendForSignature()` only sends lease agreement emails
3. WHEN analyzing API endpoints, THE System SHALL identify if both `/leads/:id/send` and `/leases/:id/send-for-signature` are being called
4. WHEN reviewing event handlers or webhooks, THE System SHALL determine if any automated triggers are causing duplicate sends
5. WHEN checking for shared dependencies, THE System SHALL identify if both workflows share email sending logic that could cause duplication

### Requirement 3: Fix Duplicate Email Issue

**User Story:** As a user, I want to send only the correct LOI email when sending a Letter of Intent, so that recipients don't receive confusing duplicate emails.

#### Acceptance Criteria

1. WHEN sending an LOI email, THE System SHALL send only the LOI email with subject format "LOI for [Suite] at [Property]"
2. WHEN sending an LOI email, THE System SHALL NOT send any lease agreement emails
3. WHEN the LOI workflow is triggered, THE System SHALL prevent any lease agreement email workflows from executing
4. WHEN fixing the duplicate issue, THE System SHALL maintain the existing LOI email functionality
5. WHEN fixing the duplicate issue, THE System SHALL ensure the lease agreement workflow remains functional for its intended use cases

### Requirement 4: Prevent Regression

**User Story:** As a developer, I want to ensure that fixing the LOI duplicate email issue doesn't break other email workflows, so that all email functionality continues to work correctly.

#### Acceptance Criteria

1. WHEN the fix is implemented, THE System SHALL continue to send lease agreement emails correctly when the lease agreement workflow is intentionally triggered
2. WHEN the fix is implemented, THE System SHALL continue to send other lead-related emails (approval emails, renewal letters, tenant magic links) correctly
3. WHEN testing the fix, THE System SHALL verify that LOI emails contain the correct attachments and content
4. WHEN testing the fix, THE System SHALL verify that lease agreement emails are only sent through the DocuSign workflow
5. WHEN validating the solution, THE System SHALL ensure no other email workflows are affected by the changes

### Requirement 5: Add Logging and Monitoring

**User Story:** As a developer, I want enhanced logging around email sending, so that I can monitor and debug email issues more effectively in the future.

#### Acceptance Criteria

1. WHEN an LOI email is sent, THE System SHALL log the email type, recipient, and workflow that triggered it
2. WHEN a lease agreement email is sent, THE System SHALL log the email type, recipient, and workflow that triggered it
3. WHEN multiple email workflows are triggered simultaneously, THE System SHALL log warnings about potential duplicate sends
4. WHEN email sending fails, THE System SHALL log detailed error information including the workflow context
5. WHEN debugging email issues, THE System SHALL provide clear log messages that distinguish between different email workflows