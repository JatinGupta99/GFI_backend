import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Suite, SuiteDocument } from '../schema/suite.schema';

@Injectable()
export class SuiteRepository {
  constructor(
    @InjectModel(Suite.name) private suiteModel: Model<SuiteDocument>,
  ) {}

  async upsertSuite(
    propertyId: string,
    suiteId: string,
    suiteData: Partial<Suite>,
  ): Promise<SuiteDocument> {
    return this.suiteModel
      .findOneAndUpdate(
        { propertyId, suiteId },
        { $set: { ...suiteData, propertyId, suiteId } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async upsertManySuites(
    propertyId: string,
    suites: Array<{ suiteId: string; data: Partial<Suite> }>,
  ): Promise<void> {
    const bulkOps = suites.map((suite) => ({
      updateOne: {
        filter: { propertyId, suiteId: suite.suiteId },
        update: {
          $set: { ...suite.data, propertyId, suiteId: suite.suiteId },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.suiteModel.bulkWrite(bulkOps);
    }
  }

  async findByPropertyId(propertyId: string): Promise<SuiteDocument[]> {
    return this.suiteModel.find({ propertyId }).exec();
  }

  async findBySuiteId(
    propertyId: string,
    suiteId: string,
  ): Promise<SuiteDocument | null> {
    return this.suiteModel.findOne({ propertyId, suiteId }).exec();
  }
}
