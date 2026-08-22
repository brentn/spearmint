import { describe, expect, it } from 'vitest';
import { StatementImportError, parseOfxStatement } from './ofx-parser.util';

// A realistic SGML-dialect OFX/QFX export: leaf value tags (FITID, DTPOSTED, ...) have no
// closing tag, implicitly closed by the next tag — the common real-world bank export style.
const SGML_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260815120000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>987654321
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801000000
<DTEND>20260815000000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260810120000[0:GMT]
<TRNAMT>-42.50
<FITID>2026081012345
<NAME>Coffee Shop
<MEMO>Card purchase
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260812
<TRNAMT>1500
<FITID>2026081298765
<MEMO>Payroll deposit
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>3215.75
<DTASOF>20260815120000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

// The XML dialect (OFX 2.x): every tag explicitly closed, including leaves.
const XML_OFX = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="200" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260810</DTPOSTED>
            <TRNAMT>-12.34</TRNAMT>
            <FITID>xml-1</FITID>
            <NAME>Grocery Store</NAME>
            <MEMO>Card purchase</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>500.00</BALAMT>
          <DTASOF>20260815</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

describe('parseOfxStatement', () => {
  it('parses transactions and the ledger balance from an SGML-dialect file', () => {
    const result = parseOfxStatement(SGML_OFX);

    expect(result.transactions).toEqual([
      { fitid: '2026081012345', datePosted: '2026-08-10', amount: -42.5, name: 'Coffee Shop' },
      { fitid: '2026081298765', datePosted: '2026-08-12', amount: 1500, name: 'Payroll deposit' },
    ]);
    expect(result.ledgerBalance).toEqual({ amount: 3215.75, dateAsOf: '2026-08-15' });
  });

  it('parses transactions and the ledger balance from an XML-dialect (OFX 2.x) file', () => {
    const result = parseOfxStatement(XML_OFX);

    expect(result.transactions).toEqual([
      { fitid: 'xml-1', datePosted: '2026-08-10', amount: -12.34, name: 'Grocery Store' },
    ]);
    expect(result.ledgerBalance).toEqual({ amount: 500, dateAsOf: '2026-08-15' });
  });

  it('falls back to NAME when MEMO is absent', () => {
    const noMemo = SGML_OFX.replace('<MEMO>Card purchase\n', '');
    const result = parseOfxStatement(noMemo);

    expect(result.transactions[0].name).toBe('Coffee Shop');
  });

  it('falls back to MEMO when it presents a fuller version of a truncated NAME', () => {
    // Mirrors a real bank export: NAME cut off mid-word with a trailing "...", MEMO carrying
    // the same description in full.
    const truncated = SGML_OFX.replace('<NAME>Coffee Shop', '<NAME>Interac eTransfer Outgoing To...').replace(
      '<MEMO>Card purchase',
      '<MEMO>Interac eTransfer Outgoing To: George Jacob'
    );

    const result = parseOfxStatement(truncated);

    expect(result.transactions[0].name).toBe('Interac eTransfer Outgoing To: George Jacob');
  });

  it('decodes basic XML entities in a transaction memo', () => {
    const withEntity = SGML_OFX.replace('<MEMO>Payroll deposit', '<MEMO>AT&amp;T Payroll deposit');

    const result = parseOfxStatement(withEntity);

    expect(result.transactions[1].name).toBe('AT&T Payroll deposit');
  });

  it('returns an empty transaction list for a statement with a balance but no activity', () => {
    const noActivity = SGML_OFX.replace(
      /<STMTTRN>[\s\S]*<\/STMTTRN>\n<STMTTRN>[\s\S]*<\/STMTTRN>\n/,
      ''
    );

    const result = parseOfxStatement(noActivity);

    expect(result.transactions).toEqual([]);
    expect(result.ledgerBalance).toEqual({ amount: 3215.75, dateAsOf: '2026-08-15' });
  });

  it('throws a StatementImportError for text with no recognizable OFX root', () => {
    expect(() => parseOfxStatement('just some random text, not a statement file')).toThrow(
      StatementImportError
    );
  });

  it('throws a StatementImportError for an empty file', () => {
    expect(() => parseOfxStatement('')).toThrow(StatementImportError);
  });

  it('throws a StatementImportError when a transaction is missing FITID', () => {
    const broken = SGML_OFX.replace('<FITID>2026081012345\n', '');

    expect(() => parseOfxStatement(broken)).toThrow(StatementImportError);
  });

  it('throws a StatementImportError when a transaction has an unreadable amount', () => {
    const broken = SGML_OFX.replace('<TRNAMT>-42.50', '<TRNAMT>not-a-number');

    expect(() => parseOfxStatement(broken)).toThrow(StatementImportError);
  });

  it('throws a StatementImportError when the file has no LEDGERBAL', () => {
    const broken = SGML_OFX.replace(/<LEDGERBAL>[\s\S]*<\/LEDGERBAL>\n/, '');

    expect(() => parseOfxStatement(broken)).toThrow(StatementImportError);
  });

  it('rounds amounts to the cent to avoid binary floating-point drift', () => {
    const drift = SGML_OFX.replace('<TRNAMT>-42.50', '<TRNAMT>19.999999999998');

    const result = parseOfxStatement(drift);

    expect(result.transactions[0].amount).toBe(20);
  });
});
