import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MriVacantSuitesService } from '../rent-roll/mri/mri-vacant-suites.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyRepository } from './repository/property.repository';
import { Property } from './schema/property.entity';

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);
  private readonly PROPERTIES_CACHE_KEY = 'properties_all';

  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly mriVacantSuitesService: MriVacantSuitesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async create(createPropertyDto: CreatePropertyDto) {
    const result = await this.propertyRepository.create(createPropertyDto);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async findAll(): Promise<Property[]> {
    const cachedData = await this.cacheManager.get<Property[]>(this.PROPERTIES_CACHE_KEY);
    if (cachedData) {
      this.logger.log('Returning properties from cache');
      return cachedData;
    }

    this.logger.log('[EXEC] Fetching properties from database');
    const properties = await this.propertyRepository.findAll();
    await this.cacheManager.set(this.PROPERTIES_CACHE_KEY, properties, 3600000); // 1 hour
    return properties;
  }

  findOne(propertyId: string) {
    return this.propertyRepository.findById(propertyId);
  }

  async update(propertyId: string, updatePropertyDto: UpdatePropertyDto) {
    const result = await this.propertyRepository.update(propertyId, updatePropertyDto);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async remove(propertyId: string) {
    const result = await this.propertyRepository.delete(propertyId);
    await this.cacheManager.del(this.PROPERTIES_CACHE_KEY);
    return result;
  }

  async getVacantSuites(buildingId: string, afterDate?: string) {
    const vacantSuites = await this.mriVacantSuitesService.fetch(buildingId, afterDate);

    return vacantSuites;
  }
}

