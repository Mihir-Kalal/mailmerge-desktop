import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import * as templateService from './services/templateService';
import * as smtpService from './services/smtpService';
import * as contactService from './services/contactService';
import * as campaignService from './services/campaignService';
import * as aiService from './services/aiService';
import { getDb } from './db/database';

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  // --- Templates ---
  ipcMain.handle('templates:list', () => templateService.listTemplates());
  ipcMain.handle('templates:save', (_e, input) => templateService.saveTemplate(input));
  ipcMain.handle('templates:delete', (_e, id) => templateService.deleteTemplate(id));
  ipcMain.handle('templates:duplicate', (_e, id) => templateService.duplicateTemplate(id));

  // --- SMTP ---
  ipcMain.handle('smtp:list', () => smtpService.listSmtpConfigs());
  ipcMain.handle('smtp:save', (_e, input) => smtpService.saveSmtpConfig(input));
  ipcMain.handle('smtp:delete', (_e, id) => smtpService.deleteSmtpConfig(id));
  ipcMain.handle('smtp:test', (_e, id) => smtpService.testSmtpConnection(id));

  // --- Contacts ---
  ipcMain.handle('contacts:list', () => contactService.listContactLists());
  ipcMain.handle('contacts:import', (_e, filePath, name) => contactService.importContactList(filePath, name));
  ipcMain.handle('contacts:delete', (_e, id) => contactService.deleteContactList(id));
  ipcMain.handle('contacts:setEmailColumn', (_e, id, col) => contactService.updateEmailColumn(id, col));

  // --- File dialogs ---
  ipcMain.handle('dialog:openSpreadsheet', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Spreadsheets', extensions: ['csv', 'xlsx', 'xlsm'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openAttachment', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('dialog:saveCsv', async (_e, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    return result.canceled ? null : result.filePath || null;
  });

  // --- Campaigns ---
  ipcMain.handle('campaigns:list', () => campaignService.listCampaigns());
  ipcMain.handle('campaigns:create', (_e, name, templateId, smtpConfigId, contactListId, limits) =>
    campaignService.createCampaign(name, templateId, smtpConfigId, contactListId, limits)
  );
  ipcMain.handle('campaigns:run', async (_e, id) => {
    // Fire and forget; progress streams back via 'campaign:progress' events.
    campaignService.runCampaign(id, getWindow()).catch((err) => {
      getWindow()?.webContents.send('campaign:error', { campaignId: id, message: err?.message || String(err) });
    });
    return true;
  });
  ipcMain.handle('campaigns:pause', (_e, id) => campaignService.pauseCampaign(id));
  ipcMain.handle('campaigns:resume', (_e, id) => campaignService.resumeCampaign(id));
  ipcMain.handle('campaigns:cancel', (_e, id) => campaignService.cancelCampaign(id));
  ipcMain.handle('campaigns:delete', (_e, id) => campaignService.deleteCampaign(id));
  ipcMain.handle('campaigns:duplicate', (_e, id) => campaignService.duplicateCampaign(id));
  ipcMain.handle('campaigns:exportLogs', async (_e, id) => {
    const csv = campaignService.exportCampaignLogsToCsv(id);
    const result = await dialog.showSaveDialog({
      defaultPath: `campaign-${id}-logs.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, csv, 'utf-8');
    return result.filePath;
  });

  // --- AI Assistant ---
  ipcMain.handle('ai:saveKey', (_e, key) => aiService.saveAiApiKey(key));
  ipcMain.handle('ai:hasKey', () => aiService.hasAiApiKey());
  ipcMain.handle('ai:run', (_e, req) => aiService.runAiAction(req));

  // --- Drafts / autosave ---
  ipcMain.handle('drafts:save', (_e, id: string, data: unknown) => {
    const db = getDb();
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO drafts (id, data, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`
    ).run(id, JSON.stringify(data), updatedAt);
    return true;
  });
  ipcMain.handle('drafts:load', (_e, id: string) => {
    const db = getDb();
    const row = db.prepare('SELECT data FROM drafts WHERE id = ?').get(id) as any;
    return row ? JSON.parse(row.data) : null;
  });

  // --- Attachment helper: resolve a path picked via dialog into {fileName, filePath} ---
  ipcMain.handle('attachments:describe', (_e, filePath: string) => ({
    fileName: path.basename(filePath),
    filePath
  }));
}
