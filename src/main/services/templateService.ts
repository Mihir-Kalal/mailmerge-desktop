import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { Template } from '../../shared/types';

function rowToTemplate(row: any): Template {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    signatureHtml: row.signatureHtml,
    attachments: JSON.parse(row.attachments),
    isHtml: !!row.isHtml,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function listTemplates(): Template[] {
  const rows = getDb().prepare('SELECT * FROM templates ORDER BY updatedAt DESC').all();
  return rows.map(rowToTemplate);
}

export function getTemplate(id: string): Template | undefined {
  const row = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id);
  return row ? rowToTemplate(row) : undefined;
}

export function saveTemplate(input: Omit<Template, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Template {
  const db = getDb();
  const now = new Date().toISOString();
  if (input.id) {
    const existing = getTemplate(input.id);
    if (existing) {
      db.prepare(
        `UPDATE templates SET name=?, subject=?, bodyHtml=?, signatureHtml=?, attachments=?, isHtml=?, updatedAt=? WHERE id=?`
      ).run(
        input.name,
        input.subject,
        input.bodyHtml,
        input.signatureHtml,
        JSON.stringify(input.attachments),
        input.isHtml ? 1 : 0,
        now,
        input.id
      );
      return { ...existing, ...input, id: input.id, updatedAt: now };
    }
  }
  const id = input.id || uuid();
  db.prepare(
    `INSERT INTO templates (id, name, subject, bodyHtml, signatureHtml, attachments, isHtml, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.subject,
    input.bodyHtml,
    input.signatureHtml,
    JSON.stringify(input.attachments),
    input.isHtml ? 1 : 0,
    now,
    now
  );
  return { id, createdAt: now, updatedAt: now, ...input };
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
}

export function duplicateTemplate(id: string): Template | undefined {
  const original = getTemplate(id);
  if (!original) return undefined;
  return saveTemplate({ ...original, name: `${original.name} (Copy)`, id: undefined as any });
}
