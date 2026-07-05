import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { getDb } from '../db/database';
import { Contact, ContactList } from '../../shared/types';

function rowToList(row: any): ContactList {
  return {
    id: row.id,
    name: row.name,
    columns: JSON.parse(row.columns),
    contacts: JSON.parse(row.contacts),
    emailColumn: row.emailColumn,
    createdAt: row.createdAt
  };
}

export function listContactLists(): ContactList[] {
  const rows = getDb().prepare('SELECT * FROM contact_lists ORDER BY createdAt DESC').all();
  return rows.map(rowToList);
}

export function getContactList(id: string): ContactList | undefined {
  const row = getDb().prepare('SELECT * FROM contact_lists WHERE id = ?').get(id);
  return row ? rowToList(row) : undefined;
}

function detectEmailColumn(columns: string[]): string {
  const exact = columns.find((c) => c.trim().toLowerCase() === 'email');
  if (exact) return exact;
  const contains = columns.find((c) => c.toLowerCase().includes('email'));
  return contains || columns[0];
}

async function parseCsv(filePath: string): Promise<{ columns: string[]; contacts: Contact[] }> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });
  const columns = parsed.meta.fields || [];
  const contacts = (parsed.data || []).filter((r) => Object.values(r).some((v) => v && v.trim() !== ''));
  return { columns, contacts };
}

async function parseXlsx(filePath: string): Promise<{ columns: string[]; contacts: Contact[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], contacts: [] };

  const columns: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    columns.push(String(cell.value ?? '').trim());
  });

  const contacts: Contact[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const contact: Contact = {};
    let hasValue = false;
    columns.forEach((colName, idx) => {
      const cell = row.getCell(idx + 1);
      let value = cell.value;
      if (value && typeof value === 'object' && 'text' in (value as any)) {
        value = (value as any).text; // rich text / hyperlink cells
      }
      const strValue = value === null || value === undefined ? '' : String(value);
      if (strValue.trim() !== '') hasValue = true;
      contact[colName] = strValue;
    });
    if (hasValue) contacts.push(contact);
  });

  return { columns, contacts };
}

export async function importContactList(filePath: string, name?: string): Promise<ContactList> {
  const ext = path.extname(filePath).toLowerCase();
  let parsed: { columns: string[]; contacts: Contact[] };

  if (ext === '.csv') {
    parsed = await parseCsv(filePath);
  } else if (ext === '.xlsx' || ext === '.xlsm') {
    parsed = await parseXlsx(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Please upload a .csv or .xlsx file.`);
  }

  if (parsed.columns.length === 0) {
    throw new Error('No columns detected. Make sure the first row contains column headers.');
  }
  if (parsed.contacts.length === 0) {
    throw new Error('No recipient rows found in the uploaded file.');
  }

  const emailColumn = detectEmailColumn(parsed.columns);
  const id = uuid();
  const createdAt = new Date().toISOString();
  const listName = name || path.basename(filePath);

  getDb()
    .prepare(
      `INSERT INTO contact_lists (id, name, columns, contacts, emailColumn, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, listName, JSON.stringify(parsed.columns), JSON.stringify(parsed.contacts), emailColumn, createdAt);

  return { id, name: listName, columns: parsed.columns, contacts: parsed.contacts, emailColumn, createdAt };
}

export function deleteContactList(id: string): void {
  getDb().prepare('DELETE FROM contact_lists WHERE id = ?').run(id);
}

export function updateEmailColumn(id: string, emailColumn: string): void {
  getDb().prepare('UPDATE contact_lists SET emailColumn = ? WHERE id = ?').run(emailColumn, id);
}
