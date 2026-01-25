export interface TenantDto {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface LeaseDto {
  readonly leaseId: string;
  readonly buildingId: string;
  readonly suiteId: string;
  readonly address: string;
  readonly tenants: readonly TenantDto[];
}
