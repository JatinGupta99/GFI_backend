import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import mongoose from 'mongoose';
import { Property, PropertyDocument } from '../schema/property.entity';
import { PropertyName } from '../enums/property-name.enum';

@Injectable()
export class PropertySeeder {
  private readonly logger = new Logger(PropertySeeder.name);

  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
  ) { }

  async seed(): Promise<void> {
    try {
      console.log("🌱 seeding properties...internally");
      // wait for mongoose connection to be ready (up to 30s)
      // await this.waitForMongooseConnection(30000);
      const count = await this.propertyModel.countDocuments();
      if (count > 0) {
        console.log('⚠️ Properties already exist. Skipping seed.');
        this.logger.log('Properties already exist. Skipping seed.');
        return;
      }

      const properties = [
        { propertyId: 1, propertyName: PropertyName.DELTONA_COMMONS, region: 'FL' },
        { propertyId: 2, propertyName: PropertyName.LAKE_CAY_COMMONS, region: 'FL' },
        { propertyId: 3, propertyName: PropertyName.STONEYBROOK_WEST_VILLAGE_1, region: 'FL' },
        { propertyId: 4, propertyName: PropertyName.STONEYBROOK_WEST_VILLAGE_2, region: 'FL' },
        { propertyId: 5, propertyName: PropertyName.FAIRWAY_OAKS, region: 'FL' },
        { propertyId: 6, propertyName: PropertyName.NORTHBAY_COMMERCE, region: 'TX' },
        { propertyId: 7, propertyName: PropertyName.AVENIR_TOWN_CENTER, region: 'TX' },
        { propertyId: 8, propertyName: PropertyName.PROMENADE_SHOPPING_CENTER, region: 'TX' },
        { propertyId: 9, propertyName: PropertyName.RIVERSIDE_SQUARE, region: 'TX' },
        { propertyId: 10, propertyName: PropertyName.SUNRISE_WEST, region: 'FL' },
        { propertyId: 11, propertyName: PropertyName.PINE_PLAZA, region: 'FL' },
        { propertyId: 12, propertyName: PropertyName.BISCAYNE_MIDPOINT, region: 'FL' },
        { propertyId: 13, propertyName: PropertyName.DIXIE_POINTE, region: 'FL' },
        { propertyId: 14, propertyName: PropertyName.RAYFORD_RIDGE, region: 'TX' },
        { propertyId: 15, propertyName: PropertyName.LEXINGTON_PLAZA, region: 'TX' },
        { propertyId: 16, propertyName: PropertyName.WEST_OAKS_CENTRE, region: 'TX' },
        { propertyId: 17, propertyName: PropertyName.PEARLAND_CORNERS, region: 'TX' },
        { propertyId: 18, propertyName: PropertyName.CHAMPION_FOREST, region: 'TX' },
        { propertyId: 19, propertyName: PropertyName.CROSSROADS_SHOPPING_CENTER, region: 'TX' },
        { propertyId: 20, propertyName: PropertyName.RICHWOOD, region: 'TX' },
        { propertyId: 21, propertyName: PropertyName.GRAND_AVENUE_CENTER, region: 'FL' },
      ];

      console.log("📝 Inserting properties...");
      // Retry insertMany for transient connection issues
      const maxAttempts = 5;
      let attempt = 0;
      let inserted: any[] = [];
      while (attempt < maxAttempts) {
        try {
          attempt++;
          inserted = await this.propertyModel.insertMany(properties, { ordered: false });
          console.log(`✅ Successfully inserted ${inserted.length} properties on attempt ${attempt}`);
          this.logger.log(`Properties seeded successfully - ${inserted.length} records inserted (attempt ${attempt})`);
          break;
        } catch (err) {
          this.logger.error(`Insert attempt ${attempt} failed: ${err.message}`);
          console.error(`Insert attempt ${attempt} failed:`, err.message);
          if (attempt >= maxAttempts) {
            throw err;
          }
          // wait before retrying
          await new Promise((res) => setTimeout(res, 2000 * attempt));
        }
      }
    } catch (error) {
      console.error('❌ Error seeding properties:', error.message);
      this.logger.error(`Error seeding properties: ${error.message}`, error.stack);
    }
  }
}
