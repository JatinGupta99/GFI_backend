/**
 * Utility class for cleaning and converting numeric strings to numbers.
 * Handles currency symbols, commas, and whitespace commonly found in financial PDFs.
 */
export class NumericCleanerUtil {
  /**
   * Cleans a numeric string by removing currency symbols, commas, and whitespace,
   * then converts it to a number.
   *
   * @param value - The string value to clean and convert (e.g., "$1,234.56", "1234.56", "$ 1,234")
   * @returns The numeric value, or 0 if the value cannot be converted to a valid number
   *
   * @example
   * NumericCleanerUtil.cleanNumeric("$1,234.56") // returns 1234.56
   * NumericCleanerUtil.cleanNumeric("1234.56") // returns 1234.56
   * NumericCleanerUtil.cleanNumeric("invalid") // returns 0
   */
  static cleanNumeric(value: string): number {
    // Remove currency symbols ($), commas, and whitespace
    const cleaned = value.replace(/[$,\s]/g, '');

    // Convert to number
    const number = parseFloat(cleaned);

    // Return 0 for invalid numbers (NaN)
    if (isNaN(number)) {
      return 0;
    }

    return number;
  }
}
