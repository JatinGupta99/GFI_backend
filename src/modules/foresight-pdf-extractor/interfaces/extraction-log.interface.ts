export interface ExtractionLogInterface {
  message: string;
  timestamp?: Date;
  level?: 'info' | 'warning' | 'error';
}
