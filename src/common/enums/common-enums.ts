export enum CompanyUserRole {
  OWNER='Owner',
  LEASING='Leasing',
  PROPERTY_MANAGER='Property Manager',
  SUPER_ADMIN='Super Admin'
}

export enum EmailType {
  PASSWORD_RESET = 'PASSWORD_RESET',
  SETUP_ACCOUNT = 'SETUP_ACCOUNT',
  LOGIN_OTP = 'LOGIN_OTP',
}

export enum LeadStatus {
  LEASE_NEGOTIATION = 'Lease Negotiation',
  LOI_NEGOTIATION = 'LOI Negotiation',
  OUT_FOR_EXECUTION = 'Out for Execution',
  QUALIFYING = 'Qualifying',
  NO_CONTACT = 'No Contact',
  RENEWAL_NEGOTIATION = 'Renewal Negotiation',
  DRAFTING_AMENDMENT = 'Drafting Amendment',
  LOST = 'Lost',
  PROSPECT = 'Prospect',
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
