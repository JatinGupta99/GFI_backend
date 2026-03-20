/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  hasPrev: boolean;
  offset?: number;
  cached?: boolean;
}

/**
 * Input for building pagination metadata
 */
export interface PaginationInput {
  total: number;
  page?: number;
  limit: number;
  offset?: number;
  cached?: boolean;
}

/**
 * Helper class for building standardized pagination metadata
 */
export class PaginationHelper {
  /**
   * Build standardized pagination metadata
   * Supports both page-based and offset-based pagination
   * 
   * @param input - Pagination input parameters
   * @returns Standardized pagination metadata with hasMore and hasPrev
   */
  static buildMeta(input: PaginationInput): PaginationMeta {
    const { total, limit, offset, cached } = input;
    
    // Calculate page from offset if not provided
    const page = input.page ?? (offset !== undefined ? Math.floor(offset / limit) + 1 : 1);
    
    // Calculate total pages (minimum 1)
    const totalPages = Math.ceil(total / limit) || 1;
    
    // Calculate hasMore and hasPrev
    const hasMore = page < totalPages;
    const hasPrev = page > 1;
    
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasMore,
      hasPrev,
    };
    
    // Add optional fields
    if (offset !== undefined) {
      meta.offset = offset;
    }
    
    if (cached !== undefined) {
      meta.cached = cached;
    }
    
    return meta;
  }
  
  /**
   * Build metadata from offset-based pagination
   * 
   * @param total - Total number of records
   * @param offset - Current offset
   * @param limit - Records per page
   * @param cached - Whether data is from cache
   * @returns Pagination metadata
   */
  static buildMetaFromOffset(
    total: number,
    offset: number,
    limit: number,
    cached?: boolean
  ): PaginationMeta {
    return this.buildMeta({ total, offset, limit, cached });
  }
  
  /**
   * Build metadata from page-based pagination
   * 
   * @param total - Total number of records
   * @param page - Current page number (1-indexed)
   * @param limit - Records per page
   * @param cached - Whether data is from cache
   * @returns Pagination metadata
   */
  static buildMetaFromPage(
    total: number,
    page: number,
    limit: number,
    cached?: boolean
  ): PaginationMeta {
    return this.buildMeta({ total, page, limit, cached });
  }
}
