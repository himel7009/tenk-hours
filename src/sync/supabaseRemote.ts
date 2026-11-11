import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session, Skill, SkillColor } from '../domain/types';
import type { PushBatch, RemoteChanges, RemoteRow, RemoteStore } from './types';

const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 100;
/** PostgREST returns at most 1000 rows per request by default. */
const PAGE_SIZE = 1000;
/**
 * A row's updated_at is its transaction's start time, so a write that began
 * before a pull can commit just after it with a timestamp at or below the
 * cursor. To catch those, the first pull from any given cursor also re-reads
 * this much before it. Re-read rows are applied again, which is harmless.
 */
const CURSOR_OVERLAP_MS = 5000;

interface SkillRow {
  id: string;
  name: string;
  color: SkillColor;
  target_hours: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SessionRow {
  id: string;
  skill_id: string;
  day: string;
  minutes: number;
  note: string;
  source: Session['source'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SKILL_COLUMNS = 'id,name,color,target_hours,created_at,updated_at,deleted_at';
const SESSION_COLUMNS = 'id,skill_id,day,minutes,note,source,created_at,updated_at,deleted_at';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

// Rows are trimmed to the database's limits on the way out. Data restored
// from an old backup can exceed them, and one rejected row would otherwise
// block every later sync.
function toSkillRow(skill: Skill) {
  return {
    id: skill.id,
    name: skill.name.trim().slice(0, 40) || 'Untitled',
    color: skill.color,
    target_hours: clamp(skill.targetHours, 1, 100_000),
    created_at: new Date(skill.createdAt).toISOString(),
    deleted_at: null,
  };
}

function toSessionRow(session: Session) {
  return {
    id: session.id,
    skill_id: session.skillId,
    day: session.day,
    minutes: clamp(session.minutes, 1, 1440),
    note: session.note.slice(0, 140),
    source: session.source,
    created_at: new Date(session.createdAt).toISOString(),
    deleted_at: null,
  };
}

function fromSkillRow(row: SkillRow): RemoteRow<Skill> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      name: row.name,
      color: row.color,
      targetHours: row.target_hours,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function fromSessionRow(row: SessionRow): RemoteRow<Session> {
  return {
    deleted: row.deleted_at !== null,
    row: {
      id: row.id,
      skillId: row.skill_id,
      day: row.day,
      minutes: row.minutes,
      note: row.note,
      source: row.source,
      createdAt: Date.parse(row.created_at),
    },
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

export function createSupabaseRemote(client: SupabaseClient): RemoteStore {
  /** The cursor an overlapping pull has already completed from, if any. */
  let settledCursor: string | null = null;

  async function upsert(table: 'skills' | 'sessions', rows: object[]) {
    for (const chunk of chunks(rows, UPSERT_CHUNK)) {
      const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  async function softDelete(table: 'skills' | 'sessions', ids: string[]) {
    const deleted_at = new Date().toISOString();
    for (const chunk of chunks(ids, DELETE_CHUNK)) {
      const { error } = await client.from(table).update({ deleted_at }).in('id', chunk);
      if (error) throw error;
    }
  }

  async function fetchChanged<Row>(
    table: 'skills' | 'sessions',
    columns: string,
    cursor: string | null,
  ): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = client.from(table).select(columns);
      if (cursor === null) {
        // First sync on this device: rows deleted elsewhere are of no interest.
        query = query.is('deleted_at', null);
      } else if (cursor === settledCursor) {
        query = query.gt('updated_at', cursor);
      } else {
        const since = new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString();
        query = query.gt('updated_at', since);
      }
      const { data, error } = await query
        .order('updated_at')
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  return {
    async push(batch: PushBatch) {
      // Skills first: sessions reference them.
      await upsert('skills', batch.skillUpserts.map(toSkillRow));
      await upsert('sessions', batch.sessionUpserts.map(toSessionRow));
      await softDelete('sessions', batch.sessionDeletes);
      await softDelete('skills', batch.skillDeletes);
    },

    async pull(cursor: string | null): Promise<RemoteChanges> {
      const skillRows = await fetchChanged<SkillRow>('skills', SKILL_COLUMNS, cursor);
      const sessionRows = await fetchChanged<SessionRow>('sessions', SESSION_COLUMNS, cursor);

      const newest = [...skillRows, ...sessionRows].reduce<string | null>(
        (latest, row) =>
          latest === null || Date.parse(row.updated_at) > Date.parse(latest)
            ? row.updated_at
            : latest,
        cursor,
      );

      // Nothing newer turned up, so later pulls from here can skip the overlap.
      if (newest === cursor) settledCursor = cursor;

      return {
        skills: skillRows.map(fromSkillRow),
        sessions: sessionRows.map(fromSessionRow),
        cursor: newest,
      };
    },
  };
}
