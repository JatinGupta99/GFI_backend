import { Injectable } from '@nestjs/common';
import { BaseMapper } from './base.mapper';
import { LeaseDto, TenantDto } from '../dto/lease-mri.dto';
import { MriTenantLease } from '../dto/create-mri.dto';

@Injectable()
export class MriTenantLeaseMapper extends BaseMapper<MriTenantLease, LeaseDto> {
  map(source: MriTenantLease): LeaseDto {
    return {
      leaseId: source.leaseId,
      buildingId: source.buildingId,
      suiteId: source.suiteId,
      address: [source.address1, source.address2, source.city, source.zipCode]
        .filter(Boolean)
        .join(', '),
      tenants: source.tenant.map(this.mapTenant),
    };
  }

  private mapTenant(contact: MriTenantLease['tenant'][number]): TenantDto {
    return {
      id: contact.contactId,
      fullName: `${contact.firstName} ${contact.lastName}`,
      email: contact.email1,
      phone: contact.mobilePhone ?? contact.businessPhone1,
    };
  }
}
