import { MriTenantContact, MriTenantLease } from "./dto/create-mri.dto";
import { LeaseDto, TenantDto } from "./dto/lease-mri.dto";


export class MriLeaseMapper {
  static toLeaseDto(source: MriTenantLease): LeaseDto {
    return {
      leaseId: source.leaseId,
      buildingId: source.buildingId,
      suiteId: source.suiteId,
      address: this.buildAddress(source),
      tenants: source.tenant.map(this.toTenantDto),
    };
  }

  private static toTenantDto(contact: MriTenantContact): TenantDto {
    return {
      id: contact.contactId,
      fullName: `${contact.firstName} ${contact.lastName}`,
      email: contact.email1,
      phone: contact.mobilePhone ?? contact.businessPhone1,
    };
  }

  private static buildAddress(source: MriTenantLease): string {
    return [
      source.address1,
      source.address2,
      source.city,
      source.zipCode,
    ]
      .filter((value): value is string => Boolean(value))
      .join(', ');
  }
}
