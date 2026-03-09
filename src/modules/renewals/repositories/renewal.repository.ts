import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Renewal, RenewalDocument } from '../renewal.entity';
import { RenewalReader, RenewalFilters } from '../interfaces/renewal-provider.interface';

@Injectable()
export class RenewalRepository implements RenewalReader {
  private readonly logger = new Logger(RenewalRepository.name);

  constructor(
    @InjectModel(Renewal.name)
    private readonly renewalModel: Model<RenewalDocument>,
  ) {}

  async findOne(id: string) {
    const renewal = await this.renewalModel.findById(id);
    return renewal;
  }

  async getRenewals(filters: RenewalFilters = {}): Promise<Renewal[]> {
    const query: any = {};

    if (filters.propertyIds?.length) {
      query.propertyId = { $in: filters.propertyIds };
    }

    if (filters.status?.length) {
      query.status = { $in: filters.status };
    }

    if (filters.leaseEndBefore) {
      query.leaseEnd = { ...query.leaseEnd, $lte: filters.leaseEndBefore };
    }

    if (filters.leaseEndAfter) {
      query.leaseEnd = { ...query.leaseEnd, $gte: filters.leaseEndAfter };
    }

    const queryBuilder = this.renewalModel
      .find(query)
      .sort({ leaseEnd: 1, propertyId: 1 });

    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }

    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    return queryBuilder.exec();
  }

  async countRenewals(filters: RenewalFilters = {}): Promise<number> {
    const query: any = {};

    if (filters.propertyIds?.length) {
      query.propertyId = { $in: filters.propertyIds };
    }

    if (filters.status?.length) {
      query.status = { $in: filters.status };
    }

    if (filters.leaseEndBefore) {
      query.leaseEnd = { ...query.leaseEnd, $lte: filters.leaseEndBefore };
    }

    if (filters.leaseEndAfter) {
      query.leaseEnd = { ...query.leaseEnd, $gte: filters.leaseEndAfter };
    }

    return this.renewalModel.countDocuments(query).exec();
  }

  async getRenewalsByProperty(propertyId: string): Promise<Renewal[]> {
    return this.renewalModel
      .find({ propertyId })
      .sort({ leaseEnd: 1 })
      .exec();
  }

  async getUpcomingRenewals(daysAhead: number = 90): Promise<Renewal[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return this.renewalModel
      .find({
        leaseEnd: {
          $gte: new Date(),
          $lte: cutoffDate,
        },
      })
      .sort({ leaseEnd: 1 })
      .exec();
  }

  async getRenewalById(id: string): Promise<Renewal | null> {
    return this.renewalModel.findById(id).exec();
  }

  async updateRenewalNotes(id: string, notes: string): Promise<Renewal | null> {
    return this.renewalModel
      .findByIdAndUpdate(
        id,
        { notes, updatedAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async updateRenewal(id: string, updateData: Partial<Renewal>): Promise<Renewal | null> {
    return this.renewalModel
      .findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async upsertRenewal(renewalData: Partial<Renewal>): Promise<Renewal> {
    const filter = {
      propertyId: renewalData.propertyId,
      mriLeaseId: renewalData.mriLeaseId,
    };

    const update = {
      ...renewalData,
      lastSyncAt: new Date(),
    };

    return this.renewalModel
      .findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .exec();
  }

  async bulkUpsert(renewalsData: Partial<Renewal>[]): Promise<{ created: number; updated: number }> {
    console.log(`\n💾 BulkUpsert called with ${renewalsData.length} records`);
    
    if (renewalsData.length === 0) {
      console.log(`  ⚠️  No records to upsert, returning early`);
      return { created: 0, updated: 0 };
    }
    
    const operations = renewalsData.map((renewal) => ({
      updateOne: {
        filter: {
          propertyId: renewal.propertyId,
          mriLeaseId: renewal.mriLeaseId,
        },
        update: {
          ...renewal,
          lastSyncAt: new Date(),
        },
        upsert: true,
      },
    }));
    
    console.log(`  📝 Created ${operations.length} bulk operations`);
    console.log(`  Sample operation filter:`, operations[0]?.updateOne?.filter);

    try {
      const result = await this.renewalModel.bulkWrite(operations);
      console.log(`  ✅ BulkWrite result:`, {
        upsertedCount: result.upsertedCount,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
        insertedCount: result.insertedCount,
      });
      
      return {
        created: result.upsertedCount,
        updated: result.modifiedCount,
      };
    } catch (error) {
      console.error(`  ❌ BulkWrite error:`, error.message);
      throw error;
    }
  }

  async deleteStaleRenewals(propertyId: string, syncTime: Date): Promise<number> {
    const result = await this.renewalModel.deleteMany({
      propertyId,
      lastSyncAt: { $lt: syncTime },
    });

    return result.deletedCount;
  }

  async getLastSyncTime(propertyId?: string): Promise<Date | null> {
    const query = propertyId ? { propertyId } : {};
    
    const result = await this.renewalModel
      .findOne(query)
      .sort({ lastSyncAt: -1 })
      .select('lastSyncAt')
      .exec();

    return result?.lastSyncAt || null;
  }

  async getRenewalStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byProperty: Record<string, number>;
    upcomingCount: number;
  }> {
    const [total, byStatus, byProperty, upcomingCount] = await Promise.all([
      this.renewalModel.countDocuments(),
      this.renewalModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.renewalModel.aggregate([
        { $group: { _id: '$propertyId', count: { $sum: 1 } } },
      ]),
      this.renewalModel.countDocuments({
        leaseEnd: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byProperty: byProperty.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      upcomingCount,
    };
  }
}