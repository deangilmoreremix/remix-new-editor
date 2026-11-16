import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file = process.env.WARMBLY_DB || './data/warmbly.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
  PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS mailboxes(
    id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT '',
    provider TEXT DEFAULT 'smtp', smtp_host TEXT, smtp_port INTEGER, smtp_user TEXT, smtp_pass TEXT,
    daily_cap INTEGER DEFAULT 40, min_gap_sec INTEGER DEFAULT 60,
    warmup INTEGER DEFAULT 0, warmup_day INTEGER DEFAULT 0, warmup_target INTEGER DEFAULT 40,
    status TEXT DEFAULT 'active', created_at INTEGER);
  CREATE TABLE IF NOT EXISTS contacts(
    id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, first_name TEXT DEFAULT '', last_name TEXT DEFAULT '',
    company TEXT DEFAULT '', title TEXT DEFAULT '', stage TEXT DEFAULT 'lead', notes TEXT DEFAULT '',
    created_at INTEGER);
  CREATE TABLE IF NOT EXISTS campaigns(
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'draft',
    window_start INTEGER DEFAULT 9, window_end INTEGER DEFAULT 17, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS campaign_mailboxes(campaign_id INTEGER, mailbox_id INTEGER, PRIMARY KEY(campaign_id,mailbox_id));
  CREATE TABLE IF NOT EXISTS steps(
    id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL, position INTEGER NOT NULL,
    delay_days REAL DEFAULT 0, subject TEXT DEFAULT '', body TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS enrollments(
    id INTEGER PRIMARY KEY, campaign_id INTEGER NOT NULL, contact_id INTEGER NOT NULL,
    mailbox_id INTEGER, step INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
    next_at INTEGER, UNIQUE(campaign_id, contact_id));
  CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY, direction TEXT NOT NULL, kind TEXT DEFAULT 'campaign',
    enrollment_id INTEGER, mailbox_id INTEGER, contact_id INTEGER, from_addr TEXT, to_addr TEXT,
    subject TEXT, body TEXT, status TEXT DEFAULT 'sent', read INTEGER DEFAULT 0, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS events(
    id INTEGER PRIMARY KEY, type TEXT NOT NULL, message_id INTEGER, enrollment_id INTEGER,
    campaign_id INTEGER, contact_id INTEGER, meta TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS suppressions(email TEXT PRIMARY KEY, reason TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS deals(
    id INTEGER PRIMARY KEY, contact_id INTEGER, title TEXT NOT NULL, value REAL DEFAULT 0,
    stage TEXT DEFAULT 'new', created_at INTEGER);
  CREATE TABLE IF NOT EXISTS tasks(
    id INTEGER PRIMARY KEY, contact_id INTEGER, title TEXT NOT NULL, due TEXT, done INTEGER DEFAULT 0, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS api_keys(key TEXT PRIMARY KEY, label TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS webhooks(id INTEGER PRIMARY KEY, url TEXT NOT NULL, events TEXT DEFAULT '*');
  CREATE INDEX IF NOT EXISTS idx_enr_next ON enrollments(status,next_at);
  CREATE INDEX IF NOT EXISTS idx_msg_mb ON messages(mailbox_id,created_at);
  `);
  return db;
}

export const now = () => Date.now();
export const all = (db, sql, ...p) => db.prepare(sql).all(...p);
export const get = (db, sql, ...p) => db.prepare(sql).get(...p);
export const run = (db, sql, ...p) => db.prepare(sql).run(...p);
export const insert = (db, sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
