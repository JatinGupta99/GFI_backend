export enum UserRole {
  MANAGEMENT = 'MANAGEMENT',
  ADMIN = 'ADMIN',
  LEASING = 'LEASING',
  PROPERTY_MANAGEMENT = 'PROPERTY_MANAGEMENT',
  LEGAL = 'LEGAL',
  ACCOUNTING = 'ACCOUNTING',
  VIEWER = 'VIEWER',
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
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  LOI_NEGOTIATION = 'LOI Negotiation',
  LEASE_NEGOTIATION = 'Lease Negotiation',
  QUALIFYING = 'Qualifying',
  OUT_FOR_EXECUTION = 'Out for Execution',
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

