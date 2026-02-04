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

export enum PropertyList {
  DELTONA_COMMONS = 'Deltona Commons',
  LAKE_CAY_COMMONS = 'Lake Cay Commons',
  STONEYBROOK_WEST_VILLAGE_1 = 'Stoneybrook West Village 1',
  STONEYBROOK_WEST_VILLAGE_2 = 'Stoneybrook West Village 2',
  FAIRWAY_OAKS = 'Fairway Oaks',
  NORTHBAY_COMMERCE = 'Northbay Commerce',
  AVENIR_TOWN_CENTER = 'Avenir Town Center',
  PROMENADE_SHOPPING_CENTER = 'Promenade Shopping Center',
  RIVERSIDE_SQUARE = 'Riverside Square',
  SUNRISE_WEST = 'Sunrise West',
  PINE_PLAZA = 'Pine Plaza',
  BISCAYNE_MIDPOINT = 'Biscayne (Midpoint)',
  DIXIE_POINTE = 'Dixie Pointe',
  RAYFORD_RIDGE = 'Rayford Ridge',
  LEXINGTON_PLAZA = 'Lexington Plaza',
  WEST_OAKS_CENTRE = 'West Oaks Centre',
  PEARLAND_CORNERS = 'Pearland Corners',
  CHAMPION_FOREST = 'Champion Forest',
  CROSSROADS_SHOPPING_CENTER = 'Crossroads Shopping Center',
  RICHWOOD = 'Richwood',
  GRAND_AVENUE_CENTER = 'Grand Avenue Center',
}
