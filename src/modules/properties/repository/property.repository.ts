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

  async findByName(propertyName: string): Promise<Property | null> {
    return this.propertyModel.findOne({ propertyName }).lean().exec();
  }

  async findByNameFuzzy(propertyName: string): Promise<Property | null> {
    // First try exact match
    const exact = await this.propertyModel.findOne({ propertyName }).lean().exec();
    if (exact) return exact;

    // Then try case-insensitive partial match — check if stored name appears in extracted text or vice versa
    const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const partial = await this.propertyModel
      .findOne({ propertyName: { $regex: escaped, $options: 'i' } })
      .lean()
      .exec();
    if (partial) return partial;

    // Finally, check if any stored name is a substring of the extracted text
    const all = await this.propertyModel.find().lean().exec();
    const lower = propertyName.toLowerCase();
    return all.find(p => lower.includes(p.propertyName.toLowerCase())) ?? null;
  }

  async findByMongoId(id: string): Promise<Property | null> {
    return this.propertyModel.findById(id).lean().exec();
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

  async upsert(
    propertyId: string,
    propertyData: Partial<Property>,
  ): Promise<Property> {
    return this.propertyModel
      .findOneAndUpdate(
        { propertyId },
        { $set: { ...propertyData, propertyId } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
  }
}
