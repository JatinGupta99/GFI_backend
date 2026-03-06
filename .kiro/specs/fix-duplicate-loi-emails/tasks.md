# Implementation Plan: Fix Duplicate LOI Emails

## Overview

This implementation plan addresses the duplicate email issue where both LOI and lease agreement emails are incorrectly sent when only the LOI email should be sent. The approach focuses on workflow isolation, duplicate detection, enhanced logging, and comprehensive testing to prevent regression.

## Tasks

- [ ] 1. Investigate and document current email workflows
  - Analyze the LOI email workflow in LeadsController and LeadsService
  - Analyze the lease agreement email workflow in DocuSignController and DocuSignService
  - Document all email sending code paths and identify potential overlap
  - Create a workflow mapping document showing current email triggers
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 2.5_

- [ ] 2. Implement email workflow isolation service
  - [ ] 2.1 Create EmailWorkflowContext interface and types
    - Define workflow types enum (LOI, LEASE_AGREEMENT, APPROVAL, RENEWAL)
    - Create EmailWorkflowContext interface with leadId, userId, timestamp, requestId
    - Create EmailWorkflowGuard interface for validation methods
    - _Requirements: 3.3_

  - [ ]* 2.2 Write property test for workflow context creation
    - **Property 1: Email Workflow Isolation**
    - **Validates: Requirements 2.1, 2.2, 3.2, 3.3**

  - [ ] 2.3 Implement EmailWorkflowIsolationService
    - Create service class with validateWorkflow and preventDuplicates methods
    - Implement workflow validation logic to ensure only intended workflows execute
    - Add request tracking to prevent simultaneous workflow execution
    - _Requirements: 2.1, 2.2, 3.3_

  - [ ]* 2.4 Write unit tests for EmailWorkflowIsolationService
    - Test workflow validation with valid and invalid contexts
    - Test duplicate prevention logic
    - Test error handling for validation failures
    - _Requirements: 2.1, 2.2, 3.3_

- [ ] 3. Enhance email type system
  - [ ] 3.1 Add specific email types for LOI and lease agreements
    - Add EmailType.LOI and EmailType.LEASE_AGREEMENT to common-enums.ts
    - Update existing email workflows to use specific types instead of GENERAL
    - Ensure backward compatibility with existing GENERAL type usage
    - _Requirements: 3.1, 4.3, 4.4_

  - [ ]* 3.2 Write property test for email type correctness
    - **Property 2: LOI Email Correctness**
    - **Validates: Requirements 3.1, 4.3**

  - [ ]* 3.3 Write property test for lease agreement email correctness
    - **Property 3: Lease Agreement Email Correctness**
    - **Validates: Requirements 4.1, 4.4**

- [ ] 4. Implement duplicate email detection service
  - [ ] 4.1 Create DuplicateEmailDetectionService
    - Define EmailSendRecord interface for tracking email sends
    - Implement recordEmailSend and checkForDuplicates methods
    - Add configurable time window for duplicate detection (default 5 minutes)
    - _Requirements: 5.3_

  - [ ] 4.2 Create email workflow execution tracking
    - Define EmailWorkflowExecution interface for audit trail
    - Implement tracking of email workflow executions with status
    - Add LeadEmailHistory interface for per-lead email tracking
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 4.3 Write property test for duplicate detection
    - **Property 6: Duplicate Detection Logging**
    - **Validates: Requirements 5.3**

- [ ] 5. Checkpoint - Ensure core services are working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update LOI email workflow with isolation guards
  - [ ] 6.1 Modify LeadsService.sendLoiEmail method
    - Add EmailWorkflowIsolationService dependency injection
    - Implement workflow validation before sending LOI emails
    - Add duplicate detection checks before email sending
    - Update to use EmailType.LOI instead of EmailType.GENERAL
    - _Requirements: 2.1, 3.1, 3.2, 3.3_

  - [ ] 6.2 Add enhanced logging to LOI workflow
    - Log workflow initiation with context (leadId, userId, requestId)
    - Log email sending success/failure with workflow type
    - Log duplicate detection events and prevention actions
    - _Requirements: 5.1, 5.4, 5.5_

  - [ ]* 6.3 Write property test for LOI workflow isolation
    - **Property 1: Email Workflow Isolation** (LOI specific)
    - **Validates: Requirements 2.1, 3.2, 3.3**

- [ ] 7. Update lease agreement email workflow with isolation guards
  - [ ] 7.1 Modify DocuSignController.sendForSignature method
    - Add EmailWorkflowIsolationService dependency injection
    - Implement workflow validation before sending lease agreement emails
    - Add duplicate detection checks before email sending
    - Update to use EmailType.LEASE_AGREEMENT instead of EmailType.GENERAL
    - _Requirements: 2.2, 4.1, 4.4_

  - [ ] 7.2 Add enhanced logging to lease agreement workflow
    - Log workflow initiation with context (leaseId, userId, requestId)
    - Log email sending success/failure with workflow type
    - Log duplicate detection events and prevention actions
    - _Requirements: 5.2, 5.4, 5.5_

  - [ ]* 7.3 Write property test for lease agreement workflow isolation
    - **Property 1: Email Workflow Isolation** (Lease Agreement specific)
    - **Validates: Requirements 2.2, 4.1, 4.4**

- [ ] 8. Add error handling and validation
  - [ ] 8.1 Create custom error classes
    - Implement EmailWorkflowValidationError for validation failures
    - Implement DuplicateEmailDetectedError for duplicate detection
    - Add proper error handling in controllers with appropriate HTTP status codes
    - _Requirements: 3.2, 3.3_

  - [ ] 8.2 Implement graceful error handling
    - Handle validation failures with 400 Bad Request responses
    - Handle duplicate detection with success response and prevention message
    - Handle service failures with 500 Internal Server Error and detailed logging
    - _Requirements: 5.4_

  - [ ]* 8.3 Write unit tests for error handling
    - Test validation error scenarios
    - Test duplicate detection error scenarios
    - Test service failure scenarios
    - _Requirements: 5.4_

- [ ] 9. Checkpoint - Ensure email workflows are properly isolated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Add comprehensive logging and monitoring
  - [ ] 10.1 Implement email workflow monitoring service
    - Create EmailWorkflowMonitor service for centralized logging
    - Add structured logging with consistent format across all workflows
    - Implement log aggregation for duplicate detection analysis
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ]* 10.2 Write property test for comprehensive logging
    - **Property 5: Comprehensive Email Logging**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

- [ ] 11. Regression testing for existing email workflows
  - [ ] 11.1 Test LOI email functionality preservation
    - Verify LOI emails still send with correct subject format
    - Verify LOI emails contain correct attachments and content
    - Verify follow-up activity creation still works
    - _Requirements: 3.4, 4.3_

  - [ ] 11.2 Test lease agreement email functionality preservation
    - Verify lease agreement emails still send through DocuSign workflow
    - Verify lease agreement emails contain correct content and attachments
    - Verify DocuSign envelope creation still works
    - _Requirements: 3.5, 4.1, 4.4_

  - [ ] 11.3 Test other email workflows preservation
    - Verify approval emails still work correctly
    - Verify renewal letter emails still work correctly
    - Verify tenant magic link emails still work correctly
    - _Requirements: 4.2, 4.5_

  - [ ]* 11.4 Write property test for regression prevention
    - **Property 4: Regression Prevention**
    - **Validates: Requirements 3.4, 3.5, 4.1, 4.2, 4.5**

- [ ] 12. Integration testing and validation
  - [ ] 12.1 Create end-to-end integration tests
    - Test complete LOI email workflow from API call to email delivery
    - Test complete lease agreement workflow from API call to email delivery
    - Test workflow isolation by triggering multiple workflows simultaneously
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ] 12.2 Test duplicate detection scenarios
    - Test duplicate LOI email prevention within time window
    - Test duplicate lease agreement email prevention within time window
    - Test cross-workflow duplicate detection (LOI vs lease agreement)
    - _Requirements: 5.3_

  - [ ]* 12.3 Write integration tests for email workflows
    - Test API endpoints return correct responses
    - Test email content and attachments are correct
    - Test logging and monitoring integration
    - _Requirements: 3.1, 4.1, 5.1, 5.2_

- [ ] 13. Final checkpoint - Ensure all functionality works correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests ensure end-to-end functionality works correctly