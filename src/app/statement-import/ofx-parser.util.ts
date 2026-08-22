import type { DateOnly } from '../data/models';

/** A file that can't be parsed into a usable statement — surfaced verbatim to the user
 * (spec: "a clear error rather than a silent partial import"), so messages are written
 * to be read directly rather than logged and translated. */
export class StatementImportError extends Error {}

export interface OfxTransaction {
  fitid: string;
  datePosted: DateOnly;
  amount: number;
  /** NAME, unless MEMO is a fuller version of the same text (e.g. NAME truncated with a
   * trailing "..." and MEMO carrying the untruncated description), in which case MEMO.
   * See ofx-parser.util.spec.ts for the fallback cases. */
  name: string;
}

export interface OfxLedgerBalance {
  amount: number;
  dateAsOf: DateOnly;
}

export interface OfxStatement {
  transactions: OfxTransaction[];
  ledgerBalance: OfxLedgerBalance;
}

interface OfxNode {
  tag: string;
  value: string | null;
  children: OfxNode[];
}

/**
 * Tokenizes an OFX/QFX/QBO document into a tree. Handles both the SGML dialect real bank
 * exports typically use — leaf tags like `<FITID>123` with no closing tag, implicitly closed
 * by the next tag — and the XML dialect (OFX 2.x) where every tag is explicitly closed, with
 * one pass: a leaf is never pushed onto the stack, so an explicit closing tag for it (XML)
 * simply fails the "matches stack top" check below and is ignored as a no-op, while its
 * absence (SGML) never gets in the way of the next tag being read. Whitespace between tags,
 * including newlines, is insignificant either way.
 */
function tokenizeToTree(text: string): OfxNode {
  const firstTagIndex = text.indexOf('<');
  const body = firstTagIndex === -1 ? '' : text.slice(firstTagIndex);
  const root: OfxNode = { tag: '#root', value: null, children: [] };
  const stack: OfxNode[] = [root];

  let pos = 0;
  while (pos < body.length) {
    const openIndex = body.indexOf('<', pos);
    if (openIndex === -1) {
      break;
    }
    const closeIndex = body.indexOf('>', openIndex);
    if (closeIndex === -1) {
      break;
    }
    const rawTagContent = body.slice(openIndex + 1, closeIndex).trim();
    pos = closeIndex + 1;

    if (rawTagContent.startsWith('?') || rawTagContent.startsWith('!')) {
      continue; // XML declaration / OFX processing header / comment
    }

    if (rawTagContent.startsWith('/')) {
      const tag = rawTagContent.slice(1).split(/\s/)[0].toUpperCase();
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) {
        stack.pop();
      }
      continue;
    }

    const tag = rawTagContent.split(/\s/)[0].toUpperCase();
    const nextOpenIndex = body.indexOf('<', pos);
    const rawText = nextOpenIndex === -1 ? body.slice(pos) : body.slice(pos, nextOpenIndex);
    const trimmedText = rawText.trim();

    if (trimmedText.length > 0) {
      stack[stack.length - 1].children.push({ tag, value: decodeEntities(trimmedText), children: [] });
    } else {
      const node: OfxNode = { tag, value: null, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }

  return root;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function findNode(node: OfxNode, tag: string): OfxNode | null {
  for (const child of node.children) {
    if (child.tag === tag) {
      return child;
    }
    const found = findNode(child, tag);
    if (found) {
      return found;
    }
  }
  return null;
}

function findAllNodes(node: OfxNode, tag: string): OfxNode[] {
  const results: OfxNode[] = [];
  for (const child of node.children) {
    if (child.tag === tag) {
      results.push(child);
    }
    results.push(...findAllNodes(child, tag));
  }
  return results;
}

function getDirectValue(node: OfxNode, tag: string): string | null {
  return node.children.find((c) => c.tag === tag)?.value ?? null;
}

/** OFX dates are `YYYYMMDD[HHMMSS[.XXX]][+/-TZ:TZNAME]` — only the calendar-date prefix
 * (in the statement's own local convention, per the format) is needed here. */
function parseOfxDate(raw: string, fieldLabel: string): DateOnly {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    throw new StatementImportError(`This file has an unreadable ${fieldLabel} date: "${raw}".`);
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

/** Mirrors simplefin-mapping.util's parseDecimalAmount rounding (avoids `multipleOf: 0.01`
 * schema rejections from binary floating-point drift) without importing across the
 * statement-import/simplefin boundary for one shared helper. */
function parseOfxAmount(raw: string, fieldLabel: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new StatementImportError(`This file has an unreadable ${fieldLabel} amount: "${raw}".`);
  }
  return Math.round(parsed * 100) / 100;
}

/** Some banks truncate NAME (often with a trailing "...") while MEMO carries the same
 * text in full — e.g. NAME "Interac eTransfer Outgoing To..." vs. MEMO "Interac eTransfer
 * Outgoing To: George Jacob". Detected structurally (MEMO extends NAME, stripped of its
 * truncation dots) rather than by trusting the "..." marker alone, since not every bank
 * marks truncation. Falls back to whichever field is present when only one is. */
function resolveTransactionName(name: string | null, memo: string | null): string {
  if (name && memo && memo.length > name.length) {
    const truncatedName = name.replace(/\.+$/, '');
    if (memo.startsWith(truncatedName)) {
      return memo;
    }
  }
  return name ?? memo ?? '';
}

function parseTransactionNode(node: OfxNode): OfxTransaction {
  const fitid = getDirectValue(node, 'FITID');
  const datePosted = getDirectValue(node, 'DTPOSTED');
  const amountRaw = getDirectValue(node, 'TRNAMT');
  if (!fitid || !datePosted || !amountRaw) {
    throw new StatementImportError(
      'This file has a transaction missing a required field (FITID, DTPOSTED, or TRNAMT).'
    );
  }
  const name = resolveTransactionName(getDirectValue(node, 'NAME'), getDirectValue(node, 'MEMO'));

  return {
    fitid,
    datePosted: parseOfxDate(datePosted, 'DTPOSTED'),
    amount: parseOfxAmount(amountRaw, 'TRNAMT'),
    name,
  };
}

function parseLedgerBalance(node: OfxNode): OfxLedgerBalance {
  const amountRaw = getDirectValue(node, 'BALAMT');
  const dateRaw = getDirectValue(node, 'DTASOF');
  if (!amountRaw || !dateRaw) {
    throw new StatementImportError('This file is missing its account balance (LEDGERBAL).');
  }
  return { amount: parseOfxAmount(amountRaw, 'BALAMT'), dateAsOf: parseOfxDate(dateRaw, 'DTASOF') };
}

/**
 * Parses an OFX/QFX/QBO statement file into its transactions and ledger balance (issue #39).
 * QFX and QBO are the same `<STMTTRN>` format under Quicken/QuickBooks branding — see
 * ADR-0016 — so this one parser covers all three extensions. Throws StatementImportError,
 * with a message safe to show directly to the user, for anything unrecognized or
 * incomplete rather than returning a partial result.
 */
export function parseOfxStatement(text: string): OfxStatement {
  const root = tokenizeToTree(text);
  const ofxNode = findNode(root, 'OFX');
  if (!ofxNode) {
    throw new StatementImportError('Not a recognized OFX, QFX, or QBO file.');
  }

  const transactions = findAllNodes(ofxNode, 'STMTTRN').map(parseTransactionNode);

  const ledgerBalNode = findNode(ofxNode, 'LEDGERBAL');
  if (!ledgerBalNode) {
    throw new StatementImportError('This file is missing its account balance (LEDGERBAL).');
  }
  const ledgerBalance = parseLedgerBalance(ledgerBalNode);

  return { transactions, ledgerBalance };
}
