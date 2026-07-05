import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, 'mailmerge.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS smtp_configs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      secure INTEGER NOT NULL,
      username TEXT NOT NULL,
      senderName TEXT NOT NULL,
      replyTo TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      columns TEXT NOT NULL,
      contacts TEXT NOT NULL,
      emailColumn TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      bodyHtml TEXT NOT NULL,
      signatureHtml TEXT NOT NULL,
      attachments TEXT NOT NULL,
      isHtml INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      templateId TEXT NOT NULL,
      smtpConfigId TEXT NOT NULL,
      contactListId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL,
      total INTEGER NOT NULL,
      sent INTEGER NOT NULL,
      failed INTEGER NOT NULL,
      limits TEXT NOT NULL,
      logs TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}
