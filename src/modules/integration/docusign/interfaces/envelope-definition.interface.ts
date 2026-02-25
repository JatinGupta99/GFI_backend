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

export interface EnvelopeDefinition {
  emailSubject: string;
  documents: Document[];
  recipients: {
    signers: Signer[];
  };
  status: string;
}
