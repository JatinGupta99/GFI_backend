import { MriTenantLeaseMapper } from "./mapper/mri-tenant-lease.mapper";


export enum MriApiRoute {
  TENANT_LEASE_DETAILS = 'TENANT_LEASE_DETAILS',
}

export const MriRoutes = {
  [MriApiRoute.TENANT_LEASE_DETAILS]: {
    path: '/api/applications/Integrations/CM/Leases/TenantLeaseDetails/{masterOccupantId}/{email}',
    mapper: MriTenantLeaseMapper,
  },
};
