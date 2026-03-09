import { Injectable, Logger } from '@nestjs/common';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { SuiteRepository } from './repository/suite.repository';
import { SuiteDataDto } from '../foresight-pdf-extractor/dto/suite-data.dto';

@Injectable()
export class SuitesService {
  private readonly logger = new Logger(SuitesService.name);

  constructor(private readonly suiteRepository: SuiteRepository) {}

  create(createSuiteDto: CreateSuiteDto) {
    return 'This action adds a new suite';
  }

  findAll() {
    return `This action returns all suites`;
  }

  findOne(id: number) {
    return `This action returns a #${id} suite`;
  }

  update(id: number, updateSuiteDto: UpdateSuiteDto) {
    return `This action updates a #${id} suite`;
  }

  remove(id: number) {
    return `This action removes a #${id} suite`;
  }

  /**
   * Save or update suites from ForeSight extraction
   */
  async saveForeSightSuites(
    propertyId: string,
    suites: SuiteDataDto[],
  ): Promise<void> {
    this.logger.log(
      `Saving ${suites.length} suites for property ${propertyId}`,
    );

    const suitesToUpsert = suites.map((suite) => ({
      suiteId: suite.suiteId,
      data: {
        charges: suite.charges,
        balanceDue: suite.balanceDue,
        leaseTerms: suite.leaseTerms,
        monthlyPayments: suite.monthlyPayments,
      },
    }));

    this.logger.log(
      `Prepared ${suitesToUpsert.length} suites for upsert: ${suitesToUpsert.map((s) => s.suiteId).join(', ')}`,
    );

    await this.suiteRepository.upsertManySuites(propertyId, suitesToUpsert);

    this.logger.log(
      `Successfully saved ${suites.length} suites for property ${propertyId}`,
    );
  }

  /**
   * Get all suites for a property
   */
  async findByPropertyId(propertyId: string) {
    this.logger.log(`Fetching suites for property ${propertyId}`);
    return this.suiteRepository.findByPropertyId(propertyId);
  }

  /**
   * Get a specific suite by propertyId and suiteId
   */
  async findBySuiteId(propertyId: string, suiteId: string) {
    this.logger.log(
      `Fetching suite ${suiteId} for property ${propertyId}`,
    );
    return this.suiteRepository.findBySuiteId(propertyId, suiteId);
  }
}

