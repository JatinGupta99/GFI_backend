export interface SignHereTab {
  documentId: string;
  pageNumber: string;
  xPosition: string;
  yPosition: string;
}

export interface Signer {
  email: string;
  name: string;
  recipientId: string;
  routingOrder: string;
  clientUserId?: string; // Optional: Required for embedded signing
  tabs: {
    signHereTabs: SignHereTab[];
  };
}

export interface Document {
  documentBase64: string;
  name: string;
  fileExtension: string;
  documentId: string;
}

export interface Reminders {
  reminderEnabled: string;
  reminderDelay: string;
  reminderFrequency: string;
}

export interface Expirations {
  expireEnabled: string;
  expireAfter: string;
  expireWarn: string;
}

export interface Notification {
  useAccountDefaults: string;
  reminders: Reminders;
  expirations: Expirations;
}

export interface EnvelopeDefinition {
  emailSubject: string;
  documents: Document[];
  recipients: {
    signers: Signer[];
  };
  status: string;
  notification?: Notification; // Optional: for expiration and reminder settings
}
