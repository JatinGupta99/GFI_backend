import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { LeadsModule } from '../leads/leads.module';
import { RenewalsModule } from '../renewals/renewals.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyRepository } from './repository/property.repository';
import { Property, PropertySchema } from './schema/property.entity';
import { PropertySeeder } from './seeds/property.seed';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),
    HttpModule,
    RentRollModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => RenewalsModule),
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyRepository, PropertySeeder],
  exports: [MongooseModule, PropertiesService, PropertyRepository, PropertySeeder],
})
export class PropertiesModule { }

