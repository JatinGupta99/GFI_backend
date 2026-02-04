import { EmailType } from '../enums/common-enums';

export interface EmailConfig<T = any> {
  subject: string | ((data: T) => string);
  template: string;
  required: (keyof T)[];
}

export const EmailConfigs: Record<EmailType, EmailConfig> = {
  [EmailType.PASSWORD_RESET]: {
    subject: 'Reset Your Password',
    template: 'reset-password',
    required: ['email', 'token'],
  },

  [EmailType.SETUP_ACCOUNT]: {
    subject: (data) => `Welcome ${data?.name}, Set Up Your Account`,
    template: 'setup-account',
    required: ['email', 'name', 'token'],
  },

  [EmailType.LOGIN_OTP]: {
    subject: 'Your Login Verification Code',
    template: 'login-otp',
    required: ['email', 'name', 'otp', 'year'],
  },
  [EmailType.GENERAL]: {
    subject: (data) => data?.subject || 'Notification from Global FI',
    template: 'general',
    required: ['email'],
  },
  [EmailType.COURTESY]: {
    subject: (data) => data?.subject || 'Courtesy Notice',
    template: 'courtesy',
    required: ['email'],
  },
  [EmailType.THREE_DAY]: {
    subject: (data) => data?.subject || '3-Day Notice',
    template: 'three-day',
    required: ['email'],
  },
  [EmailType.ATTORNEY]: {
    subject: (data) => data?.subject || 'Attorney Notice',
    template: 'attorney',
    required: ['email'],
  },
};
