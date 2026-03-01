export enum UserRole {
  ADMIN = 'ADMIN',
  LEASING = 'LEASING',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  LEGAL = 'LEGAL',
  ACQUISITIONS = 'ACQUISITIONS',
  MANAGEMENT = 'MANAGEMENT'
}
export enum MediaEntityType {
  LEAD = 'lead',
  PROPERTY = 'property',
  USER = 'user',
  COMPANY = 'company',
  MEDIA = 'media',
  USERS = 'users',
  LEADS = 'leads',
  EVENTS = 'events',
  GENERAL = 'general',
}
export enum EmailType {
  PASSWORD_RESET = 'PASSWORD_RESET',
  SETUP_ACCOUNT = 'SETUP_ACCOUNT',
  LOGIN_OTP = 'LOGIN_OTP',
  GENERAL = 'GENERAL',
  COURTESY = 'COURTESY',
  THREE_DAY = 'THREE_DAY',
  ATTORNEY = 'ATTORNEY',
}
export enum FormStatus {
  CREATED = 'CREATED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum Role {
  LEASING = 'LEASING',
}
export enum LeadType {
  GENERAL = 'general',
  BUSINESS = 'business',
}
export enum ActivityType {
  DOC_AI_PROCESSED = 'DOC_AI_PROCESSED',
  NOTE = 'NOTE',
  FILE_UPLOAD = 'FILE_UPLOAD',
}
export enum LeadStatus {
  PROCESSING = 'PROCESSING',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  FAILED = 'FAILED',
  NO_CONTACT = 'No Contact',
  RENEWAL_NEGOTIATION = 'Renewal Negotiation',
  DRAFTING_AMENDMENT = 'Drafting Amendment',
  LOST = 'Lost',
  PROSPECT = 'Prospect',
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  SITE_VISIT_SCHEDULED = 'site_visit_scheduled',
  PROPOSAL_SENT = 'proposal_sent',
  NEGOTIATION = 'negotiation',
  CONTRACT_SENT = 'contract_sent',
  WON = 'won',
  LOI_NEGOTIATION = 'LOI_NEGOTIATION',
  LEASE_NEGOTIATION = 'LEASE_NEGOTIATION',
  QUALIFYING = 'QUALIFYING',
  OUT_FOR_EXECUTION = 'OUT_FOR_EXECUTION',
  SEND_TO_ATTORNEY = 'SEND_TO_ATTORNEY',
  SEND_COURTESY_NOTICE = 'SEND_COURTESY_NOTICE',
  SEND_THREE_DAY_NOTICE = 'SEND_THREE_DAY_NOTICE',
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  DRAFTING_LEASE = 'DRAFTING_LEASE',
}

export enum JOBNAME {
  PROCESS_DOCUMENT = 'process-document',
  LEADS_PROCESSING = 'leads-processing'
}
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ResetTokenType {
  RESET = 'RESET',
  SETUP = 'SETUP',
  OTP = 'OTP',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum DocumentType {
  COURTESY_NOTICE = 'courtesy-notice',
  THREE_DAY_NOTICE = '3-day-notice',
  ATTORNEY_NOTICE = 'attorney-notice',
  LOI = 'loi',
  APPLICATION = 'application',
  APPROVAL_LEASE_DRAFT = 'approval-lease-draft',
  RENEWAL_LETTER = 'renewal-letter',
  APPROVAL_AMENDMENT_DRAFT = 'approval-amendment-draft',
  LEASE_DRAFT = 'lease-draft',
  EXECUTION = 'execution',
  MRI_UPLOAD = 'mri-upload',
}
