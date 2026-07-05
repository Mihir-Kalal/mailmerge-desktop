// Shared type definitions used by both the Electron main process and the React renderer.

export interface SmtpConfig {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean; // true = SSL/TLS on connect (usually port 465)
  username: string;
  // password is NEVER sent back to the renderer in plain form after saving;
  // it is stored via the OS keychain (keytar) and referenced by id only.
  senderName: string;
  replyTo?: string;
  createdAt: string;
}

export interface SmtpConfigInput extends Omit<SmtpConfig, 'id' | 'createdAt'> {
  password: string;
}

export interface Contact {
  // Arbitrary key/value pairs taken 1:1 from the uploaded spreadsheet's columns.
  // "Email" (case-insensitive match) is required for sending but every other
  // column is free-form and automatically becomes a placeholder.
  [column: string]: string;
}

export interface ContactList {
  id: string;
  name: string;
  columns: string[];
  contacts: Contact[];
  emailColumn: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  isDynamic: boolean; // true if fileName contains {{placeholders}}
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  signatureHtml: string;
  attachments: Attachment[];
  isHtml: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SendLimits {
  delayMs: number;
  randomDelayMs: number; // additional random jitter 0..randomDelayMs
  emailsPerMinute: number;
  emailsPerHour: number;
  retryCount: number;
}

export interface CampaignRecipientLog {
  contactEmail: string;
  contactSnapshot: Contact;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  smtpResponse?: string;
  errorMessage?: string;
  timestamp?: string;
}

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  smtpConfigId: string;
  contactListId: string;
  createdAt: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  total: number;
  sent: number;
  failed: number;
  limits: SendLimits;
  logs: CampaignRecipientLog[];
}

export interface ProgressUpdate {
  campaignId: string;
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  currentRecipientEmail?: string;
  currentRecipientSnapshot?: Contact;
  status: Campaign['status'];
  estimatedRemainingMs?: number;
}

export type AiAction =
  | 'improve'
  | 'professional'
  | 'friendlier'
  | 'shorten'
  | 'expand'
  | 'grammar'
  | 'subjectLines'
  | 'translate'
  | 'followUp'
  | 'tone';

export interface AiRequest {
  action: AiAction;
  text: string;
  targetLanguage?: string;
  targetTone?: string;
}
