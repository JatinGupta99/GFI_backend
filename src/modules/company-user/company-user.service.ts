import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CompanyUserRepository } from './repository/company-user.repository';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { ResetTokenType } from '../../common/enums/common-enums';
import { UserTokenService } from '../auth/user-token.service';
import { QueryCompanyUserDto } from './dto/query-company-user.dto';
import { SignatureConfirmDto } from './dto/signature-confirm.dto';
import { isValidObjectId } from 'mongoose';
import { MediaService } from '../media/media.service';

@Injectable()
export class CompanyUserService {
  constructor(
    private readonly repo: CompanyUserRepository,
    private readonly userTokenService: UserTokenService,
    private readonly mediaService: MediaService,
  ) { }

  async create(dto: CreateCompanyUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already exists');

    const user = await this.repo.create(dto);

    await this.userTokenService.requestToken(
      user._id.toString(),
      dto.email,
      dto.name,
      ResetTokenType.SETUP,
    );

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        properties: user.properties,
      },
    };
  }

  async findAll(query: QueryCompanyUserDto) {
    const result = await this.repo.findAll(query);

    return {
      users: result.users,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  async findOne(id: string) {
    const user = await this.repo.findById(id);
    return { user };
  }

  async update(id: string, dto: UpdateCompanyUserDto) {
    const user = await this.repo.update(id, dto);
    return { user };
  }

  async remove(id: string) {
    await this.repo.remove(id);
    return null;
  }

  private ensureValidObjectId(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid user ID');
  }
  async getAttachmentDownloadUrl(key: string) {
    const url = await this.mediaService.generateDownloadUrl(key);
    return {
      statusCode: 200,
      message: 'Download URL generated',
      data: { url },
    };
  }
  async getSignatureUploadUrl(userId: string, contentType: string, requestingUserId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Validate authorization
    if (userId !== requestingUserId) {
      throw new BadRequestException('Unauthorized to upload signature for this user');
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    const folderPath = `company-users/${userId}/signature`;
    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    return {
      statusCode: 200,
      message: 'Signed URL generated',
      data: {
        key,
        url,
      },
    };
  }

  async getSignatureDownloadUrl(userId: string, requestingUserId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Validate authorization
    if (userId !== requestingUserId) {
      throw new BadRequestException('Unauthorized to access signature for this user');
    }

    // if (!user.signature) {
    //   throw new NotFoundException('User has no signature');
    // }

    const url = await this.mediaService.generateDownloadUrl(user.signature);
    return { statusCode: 200, url };
  }

  async updateSignatureKey(userId: string, s3Key: string) {
    
    // Validate the user ID
    this.ensureValidObjectId(userId);
    
    const result = await this.repo.updateSignatureKey(userId, s3Key);
    
    return result;
  }

  async confirmSignature(userId: string, dto: SignatureConfirmDto) {
    
    // Validate the user ID
    this.ensureValidObjectId(userId);
    
    const updateData = {
      signature: dto.key,
      signatureFileName: dto.fileName,
      signatureFileSize: dto.fileSize,
      signatureFileType: dto.fileType,
    };
    
    const result = await this.repo.update(userId, updateData);
    
    return result;
  }
  async getUploadUrl(userId: string, contentType: string) {
    this.ensureValidObjectId(userId);
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const folderPath = `users/${userId}/profile-image`;
    const { key, url } = await this.mediaService.generateUploadUrl(folderPath, contentType);

    return {
      statusCode: 200,
      message: 'Signed URL generated',
      data: {
        key,
        url,
      },
    };
  }

  async getReadUrl(userId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.avatar) {
      throw new NotFoundException('User has no profile image');
    }

    const url = await this.mediaService.generateDownloadUrl(user.avatar);
    return { statusCode: 200, url };
  }

  async validateUser(email: string, password: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return user;
  }
}
