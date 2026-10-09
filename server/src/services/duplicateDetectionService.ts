import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

const DUPLICATE_RADIUS_METERS = 100;
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const MIN_TEXT_SIMILARITY = 0.36;
const MIN_SHARED_TERMS = 2;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on',
  'or', 'the', 'to', 'was', 'were', 'with', 'near', 'outside', 'inside', 'issue',
  'problem', 'campus', 'reported', 'broken', 'damaged', 'not', 'working'
]);

export interface DuplicateCandidate {
  title: string;
  description: string;
  category: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PotentialDuplicate {
  issue_code: string;
  title: string;
  category: string;
  location_name: string;
  status: string;
  created_at: string;
  match_reasons: string[];
}

interface ExistingIssue extends DuplicateCandidate {
  id: number;
  issue_code: string;
  status: string;
  created_at: string;
}

interface DuplicateCheckResult {
  matches: PotentialDuplicate[];
  matchIds: number[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getTerms(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
  );
}

function diceSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let overlap = 0;
  for (const term of left) {
    if (right.has(term)) overlap += 1;
  }

  return (2 * overlap) / (left.size + right.size);
}

function getSharedTermCount(left: Set<string>, right: Set<string>): number {
  let overlap = 0;
  for (const term of left) {
    if (right.has(term)) overlap += 1;
  }
  return overlap;
}

function distanceInMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

function locationsAreRelated(candidate: DuplicateCandidate, existing: ExistingIssue): boolean {
  const sameNamedLocation =
    normalizeText(candidate.location_name) === normalizeText(existing.location_name);

  if (sameNamedLocation) return true;

  if (
    candidate.latitude === null ||
    candidate.longitude === null ||
    existing.latitude === null ||
    existing.longitude === null
  ) {
    return false;
  }

  return distanceInMeters(
    candidate.latitude,
    candidate.longitude,
    existing.latitude,
    existing.longitude
  ) <= DUPLICATE_RADIUS_METERS;
}

function scoreTextSimilarity(candidate: DuplicateCandidate, existing: ExistingIssue): number {
  const candidateTitleTerms = getTerms(candidate.title);
  const existingTitleTerms = getTerms(existing.title);
  const candidateDescriptionTerms = getTerms(candidate.description);
  const existingDescriptionTerms = getTerms(existing.description);
  const candidateTerms = new Set([...candidateTitleTerms, ...candidateDescriptionTerms]);
  const existingTerms = new Set([...existingTitleTerms, ...existingDescriptionTerms]);

  if (getSharedTermCount(candidateTerms, existingTerms) < MIN_SHARED_TERMS) return 0;

  const titleSimilarity = diceSimilarity(candidateTitleTerms, existingTitleTerms);
  const descriptionSimilarity = diceSimilarity(candidateDescriptionTerms, existingDescriptionTerms);
  const textSimilarity = titleSimilarity * 0.4 + descriptionSimilarity * 0.6;

  return textSimilarity >= MIN_TEXT_SIMILARITY ? textSimilarity : 0;
}

export function findPotentialDuplicates(
  database: DatabaseSync,
  candidate: DuplicateCandidate
): DuplicateCheckResult {
  const existingIssues = database.prepare(`
    SELECT id, issue_code, title, description, category, location_name, latitude, longitude, status, created_at
    FROM issues
    WHERE status IN ('pending', 'acknowledged', 'in_progress', 'reopened')
  `).all() as unknown as ExistingIssue[];

  const matches = existingIssues
    .map((existing) => {
      if (!locationsAreRelated(candidate, existing)) return null;

      const textSimilarity = scoreTextSimilarity(candidate, existing);
      if (textSimilarity === 0) return null;

      const sameCategory =
        normalizeText(candidate.category) === normalizeText(existing.category);

      return {
        id: existing.id,
        score: textSimilarity + (sameCategory ? 0.05 : 0),
        match: {
          issue_code: existing.issue_code,
          title: existing.title,
          category: existing.category,
          location_name: existing.location_name,
          status: existing.status,
          created_at: existing.created_at,
          match_reasons: [
            'Similar title or description',
            ...(sameCategory ? ['Same category'] : []),
            normalizeText(candidate.location_name) === normalizeText(existing.location_name)
              ? 'Same campus location'
              : `Within ${DUPLICATE_RADIUS_METERS} m`
          ]
        } satisfies PotentialDuplicate
      };
    })
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .sort((left, right) => right.score - left.score || right.id - left.id);

  return {
    matches: matches.map(({ match }) => match),
    matchIds: matches.map(({ id }) => id)
  };
}

function createRequestFingerprint(candidate: DuplicateCandidate, studentId: number): string {
  const normalizedCandidate = {
    studentId,
    title: normalizeText(candidate.title),
    description: normalizeText(candidate.description),
    category: normalizeText(candidate.category),
    location_name: normalizeText(candidate.location_name),
    latitude: candidate.latitude,
    longitude: candidate.longitude
  };

  return createHash('sha256').update(JSON.stringify(normalizedCandidate)).digest('hex');
}

export function createDuplicateConfirmation(
  database: DatabaseSync,
  candidate: DuplicateCandidate,
  studentId: number,
  matchIds: number[]
): string {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + CONFIRMATION_TTL_MS;

  database.prepare('DELETE FROM issue_duplicate_confirmations WHERE expires_at <= ?').run(Date.now());
  database.prepare(`
    INSERT INTO issue_duplicate_confirmations (token_hash, request_fingerprint, match_ids, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(
    tokenHash,
    createRequestFingerprint(candidate, studentId),
    JSON.stringify(matchIds),
    expiresAt
  );

  return token;
}

export function cleanupExpiredDuplicateConfirmations(database: DatabaseSync): void {
  database.prepare('DELETE FROM issue_duplicate_confirmations WHERE expires_at <= ?').run(Date.now());
}

export function consumeDuplicateConfirmation(
  database: DatabaseSync,
  token: unknown,
  candidate: DuplicateCandidate,
  studentId: number,
  matchIds: number[]
): boolean {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const confirmation = database.prepare(`
    SELECT request_fingerprint, match_ids, expires_at
    FROM issue_duplicate_confirmations
    WHERE token_hash = ?
  `).get(tokenHash) as {
    request_fingerprint: string;
    match_ids: string;
    expires_at: number;
  } | undefined;

  if (!confirmation) return false;

  if (
    confirmation.expires_at <= Date.now() ||
    confirmation.request_fingerprint !== createRequestFingerprint(candidate, studentId) ||
    confirmation.match_ids !== JSON.stringify(matchIds)
  ) {
    return false;
  }

  const result = database.prepare(`
    DELETE FROM issue_duplicate_confirmations
    WHERE token_hash = ? AND expires_at > ?
  `).run(tokenHash, Date.now());

  return Number(result.changes) === 1;
}

export function parseDuplicateCandidate(body: unknown):
  | { candidate: DuplicateCandidate; error?: never }
  | { candidate?: never; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Please provide Title, Description, Category, and Campus Location.' };
  }

  const values = body as Record<string, unknown>;
  const requiredFields = ['title', 'description', 'category', 'location_name'] as const;
  const normalizedFields: Record<(typeof requiredFields)[number], string> = {
    title: '',
    description: '',
    category: '',
    location_name: ''
  };

  for (const field of requiredFields) {
    const value = values[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return { error: 'Please provide Title, Description, Category, and Campus Location.' };
    }
    normalizedFields[field] = value.trim();
  }

  const parseCoordinate = (value: unknown, minimum: number, maximum: number): number | null | undefined => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;

    if (typeof value === 'string' && value.trim() === '') return null;
    const coordinate = Number(typeof value === 'string' ? value.trim() : value);
    return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
      ? coordinate
      : undefined;
  };

  const latitude = parseCoordinate(values.latitude, -90, 90);
  const longitude = parseCoordinate(values.longitude, -180, 180);

  if (latitude === undefined || longitude === undefined) {
    return { error: 'Please provide valid campus coordinates.' };
  }

  if ((latitude === null) !== (longitude === null)) {
    return { error: 'Please provide both campus coordinates or leave both empty.' };
  }

  return {
    candidate: {
      ...normalizedFields,
      latitude,
      longitude
    }
  };
}
