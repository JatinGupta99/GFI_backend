export class CreateMriDto {}
export interface MriTenantContact {
  readonly contactId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email1?: string;
  readonly businessPhone1?: string;
  readonly mobilePhone?: string;

  readonly billAddress1?: string;
  readonly billAddress2?: string;
  readonly billAddress3?: string;
  readonly billCity?: string;
  readonly billCounty?: string;
  readonly billCountry?: string;
  readonly billPostCode?: string;
}

export interface MriTenantLease {
  readonly leaseId: string;
  readonly buildingId: string;
  readonly suiteId: string;
  readonly landlordId: string;

  readonly address1?: string;
  readonly address2?: string;
  readonly city?: string;
  readonly zipCode?: string;

  readonly tenant: readonly MriTenantContact[];
}

