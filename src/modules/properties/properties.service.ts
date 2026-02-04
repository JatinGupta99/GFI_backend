import { Injectable } from '@nestjs/common';
import { MriVacantSuitesService } from '../rent-roll/mri/mri-vacant-suites.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyRepository } from './repository/property.repository';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly mriVacantSuitesService: MriVacantSuitesService,
  ) { }

  create(createPropertyDto: CreatePropertyDto) {
    return this.propertyRepository.create(createPropertyDto);
  }

  findAll() {
    return this.propertyRepository.findAll();
  }

  findOne(propertyId: string) {
    return this.propertyRepository.findById(propertyId);
  }

  update(propertyId: string, updatePropertyDto: UpdatePropertyDto) {
    return this.propertyRepository.update(propertyId, updatePropertyDto);
  }

  remove(propertyId: string) {
    return this.propertyRepository.delete(propertyId);
  }

  async getVacantSuites(buildingId: string, afterDate?: string) {
    const vacantSuites = await this.mriVacantSuitesService.fetch(buildingId, afterDate);

    return vacantSuites;
  }
}

