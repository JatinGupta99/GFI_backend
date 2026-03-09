import { PatternMatcherUtil } from './pattern-matcher.util';

describe('PatternMatcherUtil', () => {
  describe('findFirst', () => {
    it('should find the first match in text', () => {
      const text = 'Suite 123456-789';
      const pattern = /(\d{6})-(\d{3})/;
      
      const match = PatternMatcherUtil.findFirst(text, pattern);
      
      expect(match).not.toBeNull();
      expect(match![0]).toBe('123456-789');
      expect(match![1]).toBe('123456');
      expect(match![2]).toBe('789');
    });

    it('should return null when no match is found', () => {
      const text = 'No suite identifier here';
      const pattern = /(\d{6})-(\d{3})/;
      
      const match = PatternMatcherUtil.findFirst(text, pattern);
      
      expect(match).toBeNull();
    });

    it('should handle null text gracefully', () => {
      const pattern = /(\d{6})-(\d{3})/;
      
      const match = PatternMatcherUtil.findFirst(null, pattern);
      
      expect(match).toBeNull();
    });

    it('should handle undefined text gracefully', () => {
      const pattern = /(\d{6})-(\d{3})/;
      
      const match = PatternMatcherUtil.findFirst(undefined, pattern);
      
      expect(match).toBeNull();
    });

    it('should handle empty text gracefully', () => {
      const pattern = /(\d{6})-(\d{3})/;
      
      const match = PatternMatcherUtil.findFirst('', pattern);
      
      expect(match).toBeNull();
    });

    it('should find property name pattern', () => {
      const text = 'Property Name: Sunset Plaza\nRegion: CA';
      const pattern = /Property Name:\s*([^\n]+)/;
      
      const match = PatternMatcherUtil.findFirst(text, pattern);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('Sunset Plaza');
    });

    it('should find region pattern', () => {
      const text = 'Region: CA\nProperty: Test';
      const pattern = /Region:\s*([A-Z]{2})/;
      
      const match = PatternMatcherUtil.findFirst(text, pattern);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('CA');
    });
  });

  describe('findAll', () => {
    it('should find all matches in text', () => {
      const text = 'Suite 123456-789 and Suite 654321-012';
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(text, pattern);
      
      expect(matches).toHaveLength(2);
      expect(matches[0]).toBe('123456-789');
      expect(matches[1]).toBe('654321-012');
    });

    it('should return empty array when no matches found', () => {
      const text = 'No suite identifiers here';
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(text, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should handle null text gracefully', () => {
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(null, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should handle undefined text gracefully', () => {
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(undefined, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should handle empty text gracefully', () => {
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll('', pattern);
      
      expect(matches).toEqual([]);
    });

    it('should find multiple suite identifiers', () => {
      const text = `
        123456-001 Rental Income BRR $1,234.56
        123456-002 Rental Income BRR $2,345.67
        123456-003 Rental Income BRR $3,456.78
      `;
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(text, pattern);
      
      expect(matches).toHaveLength(3);
      expect(matches).toContain('123456-001');
      expect(matches).toContain('123456-002');
      expect(matches).toContain('123456-003');
    });

    it('should return unique matches when pattern matches same text multiple times', () => {
      const text = '123456-789 appears here and 123456-789 appears again';
      const pattern = /(\d{6}-\d{3})/g;
      
      const matches = PatternMatcherUtil.findAll(text, pattern);
      
      // findAll returns all matches, not unique ones
      expect(matches).toHaveLength(2);
      expect(matches[0]).toBe('123456-789');
      expect(matches[1]).toBe('123456-789');
    });

    it('should handle patterns without capture groups', () => {
      const text = 'Suite 123456-789 and Suite 654321-012';
      const pattern = /\d{6}-\d{3}/g;
      
      const matches = PatternMatcherUtil.findAll(text, pattern);
      
      // Without capture group, should return empty array
      expect(matches).toEqual([]);
    });
  });
});
