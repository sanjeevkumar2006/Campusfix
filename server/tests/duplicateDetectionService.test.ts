import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  consumeDuplicateConfirmation,
  createDuplicateConfirmation,
  findPotentialDuplicates,
  parseDuplicateCandidate,
  type DuplicateCandidate
} from '../src/services/duplicateDetectionService.ts';

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    CREATE TABLE issues (
      id INTEGER PRIMARY KEY,
      issue_code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location_name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE issue_duplicate_confirmations (
      token_hash TEXT PRIMARY KEY,
      request_fingerprint TEXT NOT NULL,
      match_ids TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  return database;
}

function insertIssue(
  database: DatabaseSync,
  issue: Partial<DuplicateCandidate> & { status?: string; issue_code?: string } = {}
): void {
  database.prepare(`
    INSERT INTO issues (
      issue_code, title, description, category, location_name,
      latitude, longitude, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    issue.issue_code || 'CF-1001',
    issue.title || 'Leaking water tap',
    issue.description || 'Water continues leaking from the tap beside the library entrance.',
    issue.category || 'Water Leakage',
    issue.location_name || 'Main Library',
    issue.latitude === undefined ? 12.9716 : issue.latitude,
    issue.longitude === undefined ? 77.5946 : issue.longitude,
    issue.status || 'pending',
    '2026-10-09 10:00:00'
  );
}

const matchingCandidate: DuplicateCandidate = {
  title: 'Leaking water tap',
  description: 'Water continues leaking from the tap beside the library entrance.',
  category: 'Water Leakage',
  location_name: 'Main Library',
  latitude: 12.9716,
  longitude: 77.5946
};

test('returns no potential matches when no similar unresolved report exists', () => {
  const database = createDatabase();
  const result = findPotentialDuplicates(database, matchingCandidate);

  assert.deepEqual(result.matches, []);
  assert.deepEqual(result.matchIds, []);
});

test('detects a repeated report at the same location', () => {
  const database = createDatabase();
  insertIssue(database);

  const result = findPotentialDuplicates(database, matchingCandidate);

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].issue_code, 'CF-1001');
  assert.deepEqual(result.matchIds, [1]);
});

test('detects similar details within 100 meters when location names differ', () => {
  const database = createDatabase();
  insertIssue(database);

  const result = findPotentialDuplicates(database, {
    ...matchingCandidate,
    location_name: 'Library East Entrance',
    latitude: 12.9721,
    longitude: 77.5946
  });

  assert.equal(result.matches.length, 1);
  assert.ok(result.matches[0].match_reasons.includes('Within 100 m'));
});

test('does not match the same category and details at a different location', () => {
  const database = createDatabase();
  insertIssue(database);

  const result = findPotentialDuplicates(database, {
    ...matchingCandidate,
    location_name: 'North Sports Complex',
    latitude: 13.001,
    longitude: 77.62
  });

  assert.deepEqual(result.matches, []);
});

test('does not treat category alone as a duplicate in the same building', () => {
  const database = createDatabase();
  insertIssue(database, {
    title: 'Flickering hallway light',
    description: 'The lamp flashes on and off near the west stairwell.',
    category: 'Water Leakage'
  });

  const result = findPotentialDuplicates(database, matchingCandidate);

  assert.deepEqual(result.matches, []);
});

test('excludes resolved and closed reports', () => {
  const database = createDatabase();
  insertIssue(database, { status: 'resolved' });
  insertIssue(database, { status: 'closed', issue_code: 'CF-1002' });

  const result = findPotentialDuplicates(database, matchingCandidate);

  assert.deepEqual(result.matches, []);
});

test('includes pending, acknowledged, in-progress, and reopened reports', () => {
  const database = createDatabase();
  for (const [index, status] of ['pending', 'acknowledged', 'in_progress', 'reopened'].entries()) {
    insertIssue(database, { status, issue_code: `CF-${1001 + index}` });
  }

  const result = findPotentialDuplicates(database, matchingCandidate);

  assert.equal(result.matches.length, 4);
  assert.deepEqual(new Set(result.matches.map((match) => match.status)), new Set([
    'pending',
    'acknowledged',
    'in_progress',
    'reopened'
  ]));
  assert.equal('student_email' in result.matches[0], false);
  assert.equal('student_name' in result.matches[0], false);
});

test('falls back to an exact named location when coordinates are missing', () => {
  const database = createDatabase();
  insertIssue(database, { latitude: null, longitude: null });

  const result = findPotentialDuplicates(database, {
    ...matchingCandidate,
    latitude: null,
    longitude: null
  });

  assert.equal(result.matches.length, 1);
  assert.ok(result.matches[0].match_reasons.includes('Same campus location'));
});

test('rejects invalid or partial coordinates and requires a location name', () => {
  assert.equal(parseDuplicateCandidate(undefined).error, 'Please provide Title, Description, Category, and Campus Location.');
  assert.equal(parseDuplicateCandidate({
    ...matchingCandidate,
    latitude: '91',
    longitude: '77.5'
  }).error, 'Please provide valid campus coordinates.');

  assert.equal(parseDuplicateCandidate({
    ...matchingCandidate,
    latitude: '12.9',
    longitude: null
  }).error, 'Please provide both campus coordinates or leave both empty.');

  assert.equal(parseDuplicateCandidate({
    ...matchingCandidate,
    location_name: ' '
  }).error, 'Please provide Title, Description, Category, and Campus Location.');
  assert.equal(parseDuplicateCandidate({
    ...matchingCandidate,
    latitude: ' ',
    longitude: ' '
  }).candidate?.latitude, null);
});

test('confirmation is bound to the reporter, report details, and current matches, and is single-use', () => {
  const database = createDatabase();
  insertIssue(database);
  const { matchIds } = findPotentialDuplicates(database, matchingCandidate);
  const token = createDuplicateConfirmation(database, matchingCandidate, 7, matchIds);

  assert.equal(consumeDuplicateConfirmation(database, undefined, matchingCandidate, 7, matchIds), false);
  assert.equal(consumeDuplicateConfirmation(database, token, matchingCandidate, 8, matchIds), false);
  assert.equal(
    consumeDuplicateConfirmation(database, token, { ...matchingCandidate, title: 'Different issue' }, 7, matchIds),
    false
  );
  assert.equal(consumeDuplicateConfirmation(database, token, matchingCandidate, 7, [2]), false);
  assert.equal(consumeDuplicateConfirmation(database, token, matchingCandidate, 7, matchIds), true);
  assert.equal(consumeDuplicateConfirmation(database, token, matchingCandidate, 7, matchIds), false);
});
