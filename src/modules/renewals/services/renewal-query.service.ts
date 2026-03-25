import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RenewalRepository } from '../repositories/renewal.repository';
import { Renewal } from '../renewal.entity';
import { RenewalFilters } from '../interfaces/renewal-provider.interface';
import { MediaService } from '../../media/media.service';
import { RenewalStatus } from '../../../common/enums/common-enums';

@Injectable()
export class RenewalQueryService {
  private readonly logger = new Logger(RenewalQueryService.name);

  constructor(
    private readonly renewalRepository: RenewalRepository,
    private readonly mediaService: MediaService,
  ) {}

  async getRenewals(filters: RenewalFilters = {}): Promise<{
    data: Renewal[];
    total: number;
    cached: boolean;
  }> {
    this.logger.debug(`getRenewals called with filters: ${JSON.stringify(filters)}`);
    
    try {
      // Fetch directly from database (no caching)
      const [data, total] = await Promise.all([
        this.renewalRepository.getRenewals(filters),
        this.renewalRepository.countRenewals(filters),
      ]);
      
      this.logger.debug(`Fetched ${data.length} renewals (total: ${total}) from database`);
      
      return {
        data,
        total,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewals: ${error.message}`);
      throw error;
    }
  }

  async getRenewalsByProperty(propertyId: string): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    try {
      const data = await this.renewalRepository.getRenewalsByProperty(propertyId);
      
      return {
        data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewals for property ${propertyId}: ${error.message}`);
      throw error;
    }
  }

  async getUpcomingRenewals(daysAhead: number = 90): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    try {
      const data = await this.renewalRepository.getUpcomingRenewals(daysAhead);
      
      return {
        data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get upcoming renewals: ${error.message}`);
      throw error;
    }
  }

  async getRenewalStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byProperty: Record<string, number>;
    upcomingCount: number;
    cached: boolean;
  }> {
    try {
      const stats = await this.renewalRepository.getRenewalStats();
      
      return {
        ...stats,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewal stats: ${error.message}`);
      throw error;
    }
  }

  async searchRenewals(searchTerm: string, limit: number = 50): Promise<{
    data: Renewal[];
    cached: boolean;
  }> {
    try {
      // Perform text search on tenant name, property name, and suite
      const data = await this.renewalRepository.getRenewals({
        limit,
      });

      // Filter results based on search term (in-memory search for now)
      const filteredData = data.filter(renewal =>
        renewal.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        renewal.suite.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return {
        data: filteredData,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to search renewals: ${error.message}`);
      throw error;
    }
  }

  async updateRenewalNotes(id: string, notes: string): Promise<{
    data: Renewal | null;
    success: boolean;
  }> {
    try {
      const updated = await this.renewalRepository.updateRenewalNotes(id, notes);
      
      if (updated) {
        this.logger.log(`Updated notes for renewal ${id}`);
      }
      
      return {
        data: updated,
        success: !!updated,
      };
    } catch (error) {
      this.logger.error(`Failed to update renewal notes: ${error.message}`);
      throw error;
    }
  }

  async updateRenewalStatus(id: string, status: RenewalStatus): Promise<{
    data: Renewal | null;
    success: boolean;
  }> {
    try {
      const updated = await this.renewalRepository.updateRenewal(id, { status });
      
      if (updated) {
        this.logger.log(`Updated status for renewal ${id} to ${status}`);
      }
      
      return {
        data: updated,
        success: !!updated,
      };
    } catch (error) {
      this.logger.error(`Failed to update renewal status: ${error.message}`);
      throw error;
    }
  }

  async getRenewalById(id: string): Promise<{
    data: Renewal | null;
    cached: boolean;
  }> {
    try {
      const data = await this.renewalRepository.getRenewalById(id);
      
      return {
        data,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Failed to get renewal by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate presigned S3 upload URL for renewal file
   */
  async getFileUploadUrl(
    renewalId: string,
    contentType: string,
    category: string = 'notice',
  ) {
    // Check if renewal exists
    const renewal = await this.renewalRepository.getRenewalById(renewalId);
    if (!renewal) {
      throw new NotFoundException(`Renewal with ID ${renewalId} not found`);
    }

    // Generate folder path for S3
    const folderPath = `renewals/${renewalId}/files`;

    // Generate upload URL using MediaService
    const { key, url } = await this.mediaService.generateUploadUrl(
      folderPath,
      contentType,
    );

    return {
      statusCode: 200,
      message: 'Upload URL generated successfully',
      data: {
        key,
        url,
        category,
      },
    };
  }

  /**
   * Confirm file upload and save file metadata to renewal
   */
  async confirmFileUpload(
    renewalId: string,
    key: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    category: string = 'notice',
    userName: string = 'System',
  ) {
    // Check if renewal exists
    const renewal = await this.renewalRepository.getRenewalById(renewalId);
    if (!renewal) {
      throw new NotFoundException(`Renewal with ID ${renewalId} not found`);
    }

    // Create file info object
    const fileInfo = {
      id: key,
      key: key,
      fileName,
      fileSize,
      fileType,
      category,
      uploadedBy: userName,
      uploadedDate: new Date(),
      updatedBy: userName,
      updatedAt: new Date(),
    };

    // Add file to renewal's files array
    const files = renewal.files || [];
    files.push(fileInfo as any);

    // Update renewal with new file
    await this.renewalRepository.updateRenewal(renewalId, { files });

    this.logger.log(
      `File ${fileName} uploaded successfully for renewal ${renewalId}`,
    );

    return {
      statusCode: 200,
      message: 'File uploaded successfully',
      data: fileInfo,
    };
  }
}
