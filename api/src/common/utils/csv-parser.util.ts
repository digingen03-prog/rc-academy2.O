/**
 * RFC 4180 Compliant CSV Parser & Academy Spreadsheet Normalizer
 */

export interface ParsedCsvRow {
  [key: string]: string;
}

export interface NameSplitResult {
  firstName: string;
  lastName: string;
  isAmbiguous: boolean;
  reason?: string;
  warning?: string;
}

export interface DateParseResult {
  isValid: boolean;
  isoDate?: string;
  original: string;
  error?: string;
}

/**
 * Standardize text tokens: treat '-', 'NIL', 'Nil', 'NA', 'N/A' as empty.
 */
export function cleanCsvValue(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  const lower = trimmed.toLowerCase();
  if (['-', '--', 'nil', 'null', 'na', 'n/a', 'none', '.', 'not available'].includes(lower)) {
    return '';
  }
  return trimmed;
}

export function sanitizeCell(val: string | undefined | null): string {
  return cleanCsvValue(val);
}

export function cleanPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = String(phone).replace(/[\s\-()]/g, '');
  if (!cleaned || ['nil', 'null', 'na', '-', '.', 'none'].includes(cleaned.toLowerCase())) {
    return '';
  }
  return cleaned;
}

export function isValidEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Normalize CSV Header strings (strips BOM, collapses newlines/multiple spaces, trims, case-insensitive).
 */
export function normalizeHeaderKey(rawHeader: string): string {
  if (!rawHeader) return '';
  // Strip BOM and clean whitespace / line breaks
  const cleaned = rawHeader
    .replace(/^\uFEFF/, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Normalize specific academy headers
  const compact = cleaned.replace(/[^a-z0-9]/g, '');

  if (compact === 'dateofjoining' || compact === 'joiningdate' || compact === 'doj') {
    return 'dateOfJoining';
  }
  if (compact === 'name' || compact === 'studentname' || compact === 'fullname') {
    return 'rawName';
  }
  if (compact === 'firstname') {
    return 'firstName';
  }
  if (compact === 'lastname' || compact === 'surname') {
    return 'lastName';
  }
  if (
    compact === 'nameoftheschool' ||
    compact === 'schoolname' ||
    compact === 'school' ||
    compact === 'institution'
  ) {
    return 'schoolName';
  }
  if (compact === 'dateofbirth' || compact === 'dob') {
    return 'dob';
  }
  if (
    compact === 'fathersname' ||
    compact === 'fathername' ||
    compact === 'primaryguardianname'
  ) {
    return 'fatherName';
  }
  if (
    compact === 'fathersmobilenumber' ||
    compact === 'fathermobilenumber' ||
    compact === 'fathermobile' ||
    compact === 'fatherphone' ||
    compact === 'primaryguardianphone'
  ) {
    return 'fatherPhone';
  }
  if (
    compact === 'mothersname' ||
    compact === 'mothername' ||
    compact === 'secondaryguardianname'
  ) {
    return 'motherName';
  }
  if (
    compact === 'mothersmobilenumber' ||
    compact === 'mothermobilenumber' ||
    compact === 'mothermobile' ||
    compact === 'motherphone' ||
    compact === 'secondaryguardianphone'
  ) {
    return 'motherPhone';
  }
  if (
    compact === 'alternativenumber' ||
    compact === 'alternatenumber' ||
    compact === 'altnumber' ||
    compact === 'alternativephone' ||
    compact === 'emergencycontact'
  ) {
    return 'alternativePhone';
  }
  if (compact === 'emailid' || compact === 'email' || compact === 'emailaddress') {
    return 'email';
  }
  if (compact === 'address' || compact === 'residentialaddress') {
    return 'address';
  }
  if (
    compact === 'areyouapartof' ||
    compact === 'academicboard' ||
    compact === 'board' ||
    compact === 'curriculum'
  ) {
    return 'academicBoard';
  }
  if (compact === 'subjects' || compact === 'subject' || compact === 'subjectcode') {
    return 'subjects';
  }
  if (
    compact === 'howdoyouknowaboutouracademy' ||
    compact === 'referral' ||
    compact === 'referralsource' ||
    compact === 'source'
  ) {
    return 'referralSource';
  }
  if (compact === 'gender' || compact === 'sex') {
    return 'gender';
  }
  if (
    compact === 'coursecode' ||
    compact === 'course' ||
    compact === 'standard' ||
    compact === 'class' ||
    compact === 'grade' ||
    compact === 'cohort'
  ) {
    return 'courseCode';
  }
  if (compact === 'batchcode' || compact === 'batch' || compact === 'section') {
    return 'batchCode';
  }

  return rawHeader.trim();
}

/**
 * Robust RFC 4180 CSV tokenizer supporting:
 * - quoted values with commas
 * - escaped quotation marks ("")
 * - multiline fields inside quotes
 * - CRLF (\r\n) and LF (\n) line breaks
 */
export function parseRfc4180Csv(text: string): ParsedCsvRow[] {
  if (!text || !text.trim()) return [];

  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  let i = 0;

  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < len && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < len && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell);
        currentCell = '';
        if (currentRow.some((c) => c.trim().length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell);
        currentCell = '';
        if (currentRow.some((c) => c.trim().length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length < 2) return [];

  // Map header row
  const headerKeys = rawRows[0].map((h) => normalizeHeaderKey(h));
  const result: ParsedCsvRow[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const rowValues = rawRows[r];
    const rowObj: ParsedCsvRow = {};
    for (let c = 0; c < headerKeys.length; c++) {
      const key = headerKeys[c];
      const val = rowValues[c] !== undefined ? cleanCsvValue(rowValues[c]) : '';
      rowObj[key] = val;
    }
    result.push(rowObj);
  }

  return result;
}

/**
 * Intelligent Name Splitting with ambiguity detection.
 * Flags single-word names and 3+ word names for administrative review.
 */
export function splitStudentName(fullName: string): NameSplitResult {
  const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return {
      firstName: '',
      lastName: '',
      isAmbiguous: true,
      warning: 'Student name is missing',
    };
  }

  const parts = cleaned.split(' ');

  if (parts.length === 1) {
    const msg = `Single-word name '${parts[0]}' detected; verify first and last name partition`;
    return {
      firstName: parts[0],
      lastName: '-',
      isAmbiguous: false,
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      isAmbiguous: false,
    };
  }

  // 3 or more words
  const multiMsg = `Multi-part name '${cleaned}' split into '${parts[0]}' / '${parts.slice(1).join(' ')}'; verify partition`;
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    isAmbiguous: true,
    reason: multiMsg,
    warning: multiMsg,
  };
}

/**
 * Parse flexible date format (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, or YYYY-MM-DD).
 * Validates actual calendar boundaries (leap years, days in month, future date restriction).
 */
export function parseFlexibleDate(
  rawDate: string,
  fieldLabel: string = 'Date',
  requirePast: boolean = true,
): DateParseResult {
  const original = (rawDate || '').trim();
  if (!original) {
    return { isValid: false, original: '', error: `${fieldLabel} is required` };
  }

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // Pattern 1: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = original.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // Pattern 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = original.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      year = parseInt(dmyMatch[3], 10);
    }
  }

  if (year === null || month === null || day === null) {
    return {
      isValid: false,
      original,
      error: `Invalid ${fieldLabel} format: '${original}'. Expected DD-MM-YYYY or YYYY-MM-DD.`,
    };
  }

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      original,
      error: `Invalid month '${month}' in ${fieldLabel}: '${original}'. Must be 1-12.`,
    };
  }

  // Days in month validation including leap years
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      original,
      error: `Invalid day '${day}' in ${fieldLabel}: '${original}'. Month ${month} in ${year} only has ${daysInMonth} days.`,
    };
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();

  if (requirePast && dateObj > now) {
    return {
      isValid: false,
      original,
      error: `${fieldLabel} '${original}' cannot be in the future.`,
    };
  }

  // Format to standard ISO YYYY-MM-DD
  const pad = (n: number) => n.toString().padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;

  return {
    isValid: true,
    isoDate,
    original,
  };
}

export const parseCsvText = parseRfc4180Csv;
export const parseCsvToObjects = parseRfc4180Csv;

