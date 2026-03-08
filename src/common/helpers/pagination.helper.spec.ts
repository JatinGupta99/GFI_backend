import { PaginationHelper } from './pagination.helper';

describe('PaginationHelper', () => {
  describe('buildMetaFromPage', () => {
    it('should calculate hasMore and hasPrev for first page with more data', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 1, 20);
      
      expect(meta.total).toBe(100);
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });

    it('should calculate hasMore and hasPrev for middle page', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 3, 20);
      
      expect(meta.page).toBe(3);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should calculate hasMore and hasPrev for last page', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 5, 20);
      
      expect(meta.page).toBe(5);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle single page scenario', () => {
      const meta = PaginationHelper.buildMetaFromPage(10, 1, 20);
      
      expect(meta.totalPages).toBe(1);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    it('should handle empty results', () => {
      const meta = PaginationHelper.buildMetaFromPage(0, 1, 20);
      
      expect(meta.total).toBe(0);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    it('should include cached field when provided', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 1, 20, true);
      
      expect(meta.cached).toBe(true);
    });

    it('should not include cached field when not provided', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 1, 20);
      
      expect(meta.cached).toBeUndefined();
    });
  });

  describe('buildMetaFromOffset', () => {
    it('should calculate page from offset correctly', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 40, 20);
      
      expect(meta.page).toBe(3);
      expect(meta.offset).toBe(40);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle offset 0 as first page', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 0, 20);
      
      expect(meta.page).toBe(1);
      expect(meta.offset).toBe(0);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });

    it('should handle last page with offset', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 80, 20);
      
      expect(meta.page).toBe(5);
      expect(meta.offset).toBe(80);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    it('should include cached field when provided', () => {
      const meta = PaginationHelper.buildMetaFromOffset(100, 0, 20, true);
      
      expect(meta.cached).toBe(true);
      expect(meta.offset).toBe(0);
    });
  });

  describe('buildMeta', () => {
    it('should use page when both page and offset are provided', () => {
      const meta = PaginationHelper.buildMeta({
        total: 100,
        page: 2,
        offset: 40,
        limit: 20,
      });
      
      expect(meta.page).toBe(2);
      expect(meta.offset).toBe(40);
    });

    it('should calculate page from offset when page is not provided', () => {
      const meta = PaginationHelper.buildMeta({
        total: 100,
        offset: 40,
        limit: 20,
      });
      
      expect(meta.page).toBe(3);
      expect(meta.offset).toBe(40);
    });

    it('should default to page 1 when neither page nor offset is provided', () => {
      const meta = PaginationHelper.buildMeta({
        total: 100,
        limit: 20,
      });
      
      expect(meta.page).toBe(1);
      expect(meta.offset).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle exact page boundary', () => {
      const meta = PaginationHelper.buildMetaFromPage(100, 5, 20);
      
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(false);
    });

    it('should handle partial last page', () => {
      const meta = PaginationHelper.buildMetaFromPage(95, 5, 20);
      
      expect(meta.totalPages).toBe(5);
      expect(meta.hasMore).toBe(false);
    });

    it('should handle single item', () => {
      const meta = PaginationHelper.buildMetaFromPage(1, 1, 20);
      
      expect(meta.totalPages).toBe(1);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });
  });
});
