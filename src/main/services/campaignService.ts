import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { getDb } from '../db/database';
import { buildTransport } from './smtpService';
import { getTemplate } from './templateService';
import { getContactList } from './contactService';
import { renderEmailForContact, renderAttachmentPath } from '../../shared/placeholderEngine';
import { Campaign, CampaignRecipientLog, ProgressUpdate, SendLimits } from '../../shared/types';

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    smtpConfigId: row.smtpConfigId,
    contactListId: row.contactListId,
    createdAt: row.createdAt,
    status: row.status,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    limits: JSON.parse(row.limits),
    logs: JSON.parse(row.logs)
  };
}

export function listCampaigns(): Campaign[] {
  const rows = getDb().prepare('SELECT * FROM campaigns ORDER BY createdAt DESC').all();
  return rows.map(rowToCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const row = getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  return row ? rowToCampaign(row) : undefined;
}

function persistCampaign(c: Campaign) {
  getDb()
    .prepare(
      `UPDATE campaigns SET status=?, total=?, sent=?, failed=?, limits=?, logs=? WHERE id=?`
    )
    .run(c.status, c.total, c.sent, c.failed, JSON.stringify(c.limits), JSON.stringify(c.logs), c.id);
}

export function deleteCampaign(id: string): void {
  getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id);
  activeControllers.delete(id);
}

export function duplicateCampaign(id: string): Campaign | undefined {
  const original = getCampaign(id);
  if (!original) return undefined;
  return createCampaign(original.name + ' (Copy)', original.templateId, original.smtpConfigId, original.contactListId, original.limits);
}

export function createCampaign(
  name: string,
  templateId: string,
  smtpConfigId: string,
  contactListId: string,
  limits: SendLimits
): Campaign {
  const contactList = getContactList(contactListId);
  if (!contactList) throw new Error('Contact list not found');

  const logs: CampaignRecipientLog[] = contactList.contacts.map((c) => ({
    contactEmail: c[contactList.emailColumn] || '',
    contactSnapshot: c,
    status: 'pending',
    attempts: 0
  }));

  const campaign: Campaign = {
    id: uuid(),
    name,
    templateId,
    smtpConfigId,
    contactListId,
    createdAt: new Date().toISOString(),
    status: 'draft',
    total: logs.length,
    sent: 0,
    failed: 0,
    limits,
    logs
  };

  getDb()
    .prepare(
      `INSERT INTO campaigns (id, name, templateId, smtpConfigId, contactListId, createdAt, status, total, sent, failed, limits, logs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      campaign.id,
      campaign.name,
      campaign.templateId,
      campaign.smtpConfigId,
      campaign.contactListId,
      campaign.createdAt,
      campaign.status,
      campaign.total,
      campaign.sent,
      campaign.failed,
      JSON.stringify(campaign.limits),
      JSON.stringify(campaign.logs)
    );

  return campaign;
}

// --- Sending engine -------------------------------------------------------

interface Controller {
  paused: boolean;
  cancelled: boolean;
}

const activeControllers = new Map<string, Controller>();
const sendTimestamps = new Map<string, number[]>(); // campaignId -> recent send unix-ms timestamps (rate limiting)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit(campaignId: string, limits: SendLimits, controller: Controller) {
  const now = () => Date.now();
  while (true) {
    if (controller.cancelled) return;
    const timestamps = sendTimestamps.get(campaignId) || [];
    const oneMinuteAgo = now() - 60_000;
    const oneHourAgo = now() - 3_600_000;
    const recentMinute = timestamps.filter((t) => t > oneMinuteAgo).length;
    const recentHour = timestamps.filter((t) => t > oneHourAgo).length;

    if (limits.emailsPerMinute > 0 && recentMinute >= limits.emailsPerMinute) {
      await sleep(1000);
      continue;
    }
    if (limits.emailsPerHour > 0 && recentHour >= limits.emailsPerHour) {
      await sleep(2000);
      continue;
    }
    break;
  }
}

function recordSendTimestamp(campaignId: string) {
  const timestamps = sendTimestamps.get(campaignId) || [];
  timestamps.push(Date.now());
  sendTimestamps.set(campaignId, timestamps.slice(-10000));
}

async function waitWhilePaused(controller: Controller) {
  while (controller.paused && !controller.cancelled) {
    await sleep(300);
  }
}

function emitProgress(win: BrowserWindow | null, update: ProgressUpdate) {
  win?.webContents.send('campaign:progress', update);
}

export async function runCampaign(campaignId: string, win: BrowserWindow | null): Promise<void> {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const template = getTemplate(campaign.templateId);
  if (!template) throw new Error('Template not found for this campaign');

  const contactList = getContactList(campaign.contactListId);
  if (!contactList) throw new Error('Contact list not found for this campaign');

  const controller: Controller = { paused: false, cancelled: false };
  activeControllers.set(campaignId, controller);

  campaign.status = 'running';
  persistCampaign(campaign);

  const transport = await buildTransport(campaign.smtpConfigId);

  const startTime = Date.now();

  for (let i = 0; i < campaign.logs.length; i++) {
    const log = campaign.logs[i];
    if (controller.cancelled) {
      campaign.status = 'cancelled';
      break;
    }
    await waitWhilePaused(controller);
    if (controller.cancelled) {
      campaign.status = 'cancelled';
      break;
    }
    if (log.status === 'sent' || log.status === 'skipped') continue;

    if (!log.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(log.contactEmail)) {
      log.status = 'skipped';
      log.errorMessage = 'Missing or invalid email address';
      log.timestamp = new Date().toISOString();
      campaign.failed += 1;
      persistCampaign(campaign);
      continue;
    }

    await waitForRateLimit(campaignId, campaign.limits, controller);
    if (controller.cancelled) {
      campaign.status = 'cancelled';
      break;
    }

    log.status = 'sending';
    const rendered = renderEmailForContact(template.subject, template.bodyHtml, template.signatureHtml, log.contactSnapshot);

    const elapsed = Date.now() - startTime;
    const doneSoFar = campaign.sent + campaign.failed;
    const avgPerEmail = doneSoFar > 0 ? elapsed / doneSoFar : campaign.limits.delayMs + 500;
    const remaining = campaign.total - doneSoFar;

    emitProgress(win, {
      campaignId,
      total: campaign.total,
      sent: campaign.sent,
      failed: campaign.failed,
      remaining,
      currentRecipientEmail: log.contactEmail,
      currentRecipientSnapshot: log.contactSnapshot,
      status: 'running',
      estimatedRemainingMs: Math.round(avgPerEmail * remaining)
    });

    let attempt = 0;
    let success = false;
    let lastError = '';

    while (attempt <= campaign.limits.retryCount && !success && !controller.cancelled) {
      attempt += 1;
      log.attempts = attempt;
      try {
        const attachments = [];
        for (const att of template.attachments) {
          const resolvedPath = att.isDynamic
            ? renderAttachmentPath(att.filePath, log.contactSnapshot).text
            : att.filePath;
          if (fs.existsSync(resolvedPath)) {
            attachments.push({ filename: att.fileName, path: resolvedPath });
          }
        }

        const smtpConfigs = getDb().prepare('SELECT * FROM smtp_configs WHERE id = ?').get(campaign.smtpConfigId) as any;

        const info = await transport.sendMail({
          from: `"${smtpConfigs.senderName}" <${smtpConfigs.username}>`,
          to: log.contactEmail,
          replyTo: smtpConfigs.replyTo || undefined,
          subject: rendered.subject,
          html: rendered.bodyHtml,
          attachments
        });

        log.status = 'sent';
        log.smtpResponse = info?.response || 'OK';
        log.timestamp = new Date().toISOString();
        campaign.sent += 1;
        success = true;
        recordSendTimestamp(campaignId);
      } catch (err: any) {
        lastError = err?.message || 'Unknown send error';
        if (attempt <= campaign.limits.retryCount) {
          await sleep(1000 * attempt); // simple backoff between retries
        }
      }
    }

    if (!success) {
      log.status = 'failed';
      log.errorMessage = lastError;
      log.timestamp = new Date().toISOString();
      campaign.failed += 1;
    }

    persistCampaign(campaign);

    const delay = campaign.limits.delayMs + Math.floor(Math.random() * (campaign.limits.randomDelayMs || 0));
    if (delay > 0 && i < campaign.logs.length - 1) {
      await sleep(delay);
    }
  }

  if (campaign.status !== 'cancelled') {
    campaign.status = 'completed';
  }
  persistCampaign(campaign);
  activeControllers.delete(campaignId);

  emitProgress(win, {
    campaignId,
    total: campaign.total,
    sent: campaign.sent,
    failed: campaign.failed,
    remaining: 0,
    status: campaign.status
  });
}

export function pauseCampaign(campaignId: string): void {
  const controller = activeControllers.get(campaignId);
  if (controller) controller.paused = true;
  const campaign = getCampaign(campaignId);
  if (campaign) {
    campaign.status = 'paused';
    persistCampaign(campaign);
  }
}

export function resumeCampaign(campaignId: string): void {
  const controller = activeControllers.get(campaignId);
  if (controller) controller.paused = false;
  const campaign = getCampaign(campaignId);
  if (campaign) {
    campaign.status = 'running';
    persistCampaign(campaign);
  }
}

export function cancelCampaign(campaignId: string): void {
  const controller = activeControllers.get(campaignId);
  if (controller) controller.cancelled = true;
}

export function exportCampaignLogsToCsv(campaignId: string): string {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  const header = 'Recipient,Timestamp,Status,Attempts,SMTPResponse,ErrorMessage\n';
  const rows = campaign.logs
    .map((l) =>
      [l.contactEmail, l.timestamp || '', l.status, l.attempts, (l.smtpResponse || '').replace(/,/g, ';'), (l.errorMessage || '').replace(/,/g, ';')].join(',')
    )
    .join('\n');
  return header + rows;
}
