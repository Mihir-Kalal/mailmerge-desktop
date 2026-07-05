import { v4 as uuid } from 'uuid';
import keytar from 'keytar';
import nodemailer from 'nodemailer';
import { getDb } from '../db/database';
import { SmtpConfig, SmtpConfigInput } from '../../shared/types';

const KEYTAR_SERVICE = 'MailMergeDesktop';

function rowToConfig(row: any): SmtpConfig {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    secure: !!row.secure,
    username: row.username,
    senderName: row.senderName,
    replyTo: row.replyTo || undefined,
    createdAt: row.createdAt
  };
}

export function listSmtpConfigs(): SmtpConfig[] {
  const rows = getDb().prepare('SELECT * FROM smtp_configs ORDER BY createdAt DESC').all();
  return rows.map(rowToConfig);
}

export async function saveSmtpConfig(input: SmtpConfigInput): Promise<SmtpConfig> {
  const db = getDb();
  const id = uuid();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO smtp_configs (id, label, host, port, secure, username, senderName, replyTo, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.label,
    input.host,
    input.port,
    input.secure ? 1 : 0,
    input.username,
    input.senderName,
    input.replyTo || null,
    createdAt
  );
  // Password never touches the sqlite DB — stored in the OS-native secure keychain.
  await keytar.setPassword(KEYTAR_SERVICE, id, input.password);
  return { id, label: input.label, host: input.host, port: input.port, secure: input.secure, username: input.username, senderName: input.senderName, replyTo: input.replyTo, createdAt };
}

export async function deleteSmtpConfig(id: string): Promise<void> {
  getDb().prepare('DELETE FROM smtp_configs WHERE id = ?').run(id);
  await keytar.deletePassword(KEYTAR_SERVICE, id);
}

export async function getPasswordFor(id: string): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, id);
}

export async function buildTransport(id: string) {
  const config = listSmtpConfigs().find((c) => c.id === id);
  if (!config) throw new Error('SMTP configuration not found');
  const password = await getPasswordFor(id);
  if (!password) throw new Error('Stored password not found for this SMTP account');

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports (STARTTLS negotiated automatically)
    auth: { user: config.username, pass: password },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 15000, // fail fast instead of hanging if the host/port is wrong
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

export async function testSmtpConnection(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const transport = await buildTransport(id);
    await transport.verify();
    return { ok: true, message: 'Connection successful.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Unknown SMTP error' };
  }
}
