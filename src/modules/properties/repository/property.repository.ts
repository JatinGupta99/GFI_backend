import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property, PropertyDocument } from '../schema/property.entity';
import { CreatePropertyDto } from '../dto/create-property.dto';

@Injectable()
export class PropertyRepository {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
  ) { }

  async findAll(): Promise<Property[]> {
    return this.propertyModel.find().lean().exec();
  }

  async findById(propertyId: string): Promise<Property | null> {
    return this.propertyModel.findOne({ propertyId }).lean().exec();
  }

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const newProperty = new this.propertyModel(createPropertyDto);
    return newProperty.save();
  }

  async update(propertyId: string, updateData: Partial<Property>): Promise<Property | null> {
    return this.propertyModel.findOneAndUpdate({ propertyId }, updateData, { new: true }).lean().exec();
  }

  async delete(propertyId: string): Promise<Property | null> {
    return this.propertyModel.findOneAndDelete({ propertyId }).lean().exec();
  }
}
