import { NumericCleanerUtil } from './numeric-cleaner.util';

describe('NumericCleanerUtil', () => {
  describe('cleanNumeric', () => {
    it('should remove currency symbols and convert to number', () => {
      expect(NumericCleanerUtil.cleanNumeric('$1234.56')).toBe(1234.56);
    });

    it('should remove commas and convert to number', () => {
      expect(NumericCleanerUtil.cleanNumeric('1,234.56')).toBe(1234.56);
    });

    it('should remove currency symbols, commas, and whitespace', () => {
      expect(NumericCleanerUtil.cleanNumeric('$ 1,234.56')).toBe(1234.56);
      expect(NumericCleanerUtil.cleanNumeric('$1, 234.56')).toBe(1234.56);
    });

    it('should handle numbers without formatting', () => {
      expect(NumericCleanerUtil.cleanNumeric('1234.56')).toBe(1234.56);
      expect(NumericCleanerUtil.cleanNumeric('1234')).toBe(1234);
    });

    it('should handle zero values', () => {
      expect(NumericCleanerUtil.cleanNumeric('0')).toBe(0);
      expect(NumericCleanerUtil.cleanNumeric('$0.00')).toBe(0);
    });

    it('should return 0 for invalid numbers', () => {
      expect(NumericCleanerUtil.cleanNumeric('invalid')).toBe(0);
      expect(NumericCleanerUtil.cleanNumeric('abc')).toBe(0);
      expect(NumericCleanerUtil.cleanNumeric('')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(NumericCleanerUtil.cleanNumeric('-$1,234.56')).toBe(-1234.56);
      expect(NumericCleanerUtil.cleanNumeric('-1234.56')).toBe(-1234.56);
    });

    it('should handle large numbers', () => {
      expect(NumericCleanerUtil.cleanNumeric('$1,234,567.89')).toBe(1234567.89);
    });

    it('should handle decimal-only values', () => {
      expect(NumericCleanerUtil.cleanNumeric('$0.99')).toBe(0.99);
      expect(NumericCleanerUtil.cleanNumeric('.99')).toBe(0.99);
    });
  });
});
