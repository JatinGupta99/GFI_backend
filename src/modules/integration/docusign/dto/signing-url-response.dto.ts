/**
 * Response DTO for signing URL generation
 */
export class SigningUrlResponseDto {
  /**
   * The signing URL that the recipient should use to sign the document
   * Example: https://na4.docusign.net/Signing/EmailStart.aspx?a=...
   */
  signingUrl: string;

  /**
   * Envelope ID for tracking
   */
  envelopeId: string;

  /**
   * When the URL expires (typically 5 minutes from generation)
   */
  expiresAt: Date;
}
