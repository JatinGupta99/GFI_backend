export enum CompanyUserRole {
  OWNER = 'Owner',
  USER = 'User',
  LEASING = 'Leasing',
  PROPERTY_MANAGER = 'Property Manager',
  ACQUISITION = 'Acquisitions',
  SUPER_ADMIN = 'Super Admin',
}
export enum MediaEntityType {
  LEAD = 'lead',
  PROPERTY = 'property',
  USER = 'user',
  COMPANY = 'company',
  MEDIA = 'media',
}
export enum EmailType {
  PASSWORD_RESET = 'PASSWORD_RESET',
  SETUP_ACCOUNT = 'SETUP_ACCOUNT',
  LOGIN_OTP = 'LOGIN_OTP',
}
export enum LeadType {
  GENERAL = 'general',
  BUSINESS = 'business',
}
export enum LeadStatus {
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

export enum MediaEntityType {
  USERS = 'users',
  LEADS = 'leads',
  EVENTS = 'events',
  GENERAL = 'general',
}
