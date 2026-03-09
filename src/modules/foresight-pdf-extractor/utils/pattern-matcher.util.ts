/**
 * Utility class for centralized regex pattern matching with error handling.
 * Provides methods for finding single or multiple regex matches in text.
 */
export class PatternMatcherUtil {
  /**
   * Finds the first match of a regex pattern in the given text.
   *
   * @param text - The text to search in
   * @param pattern - The regex pattern to match
   * @returns The regex match result, or null if no match is found or text is null/empty
   *
   * @example
   * const match = PatternMatcherUtil.findFirst("Suite 123-456", /(\d{3})-(\d{3})/);
   * if (match) {
   *   console.log(match[1]); // "123"
   *   console.log(match[2]); // "456"
   * }
   */
  static findFirst(text: string | null | undefined, pattern: RegExp): RegExpExecArray | null {
    // Handle null/empty text gracefully
    if (!text) {
      return null;
    }

    // Execute regex and return match result
    const match = pattern.exec(text);
    return match;
  }

  /**
   * Finds all matches of a regex pattern in the given text.
   * Returns an array of the first captured group from each match.
   *
   * @param text - The text to search in
   * @param pattern - The regex pattern to match (should have the global flag 'g')
   * @returns Array of matched strings from the first capture group, or empty array if no matches or text is null/empty
   *
   * @example
   * const matches = PatternMatcherUtil.findAll("Suite 123-456 and 789-012", /(\d{3}-\d{3})/g);
   * console.log(matches); // ["123-456", "789-012"]
   */
  static findAll(text: string | null | undefined, pattern: RegExp): string[] {
    // Handle null/empty text gracefully
    if (!text) {
      return [];
    }

    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // Loop through all matches
    while ((match = pattern.exec(text)) !== null) {
      // Add the first captured group to results
      if (match[1] !== undefined) {
        matches.push(match[1]);
      }
    }

    return matches;
  }
}
