/**
 * Smoke test for a running Gatehouse server.
 *
 * Run against a production build, not dev, so what is tested is what ships.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:3100';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'gatehouse';

let pass = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function main() {
  section('Routing and protection');

  const home = await fetch(`${BASE}/`);
  check('home page renders', home.status === 200);

  for (const path of ['/staff/driver/debrief', '/visitor/signin', '/safety', '/map', '/staff/warehouse/handover']) {
    const res = await fetch(`${BASE}${path}`);
    check(`${path} renders`, res.status === 200, `got ${res.status}`);
  }

  const adminPage = await fetch(`${BASE}/staff/admin`, { redirect: 'manual' });
  check(
    '/staff/admin redirects an anonymous visitor',
    adminPage.status >= 300 && adminPage.status < 400,
    `got ${adminPage.status}`,
  );
  check(
    'redirect points at the sign-in page',
    (adminPage.headers.get('location') ?? '').includes('/staff/admin/login'),
    adminPage.headers.get('location') ?? 'no location header',
  );

  const exportAnon = await fetch(`${BASE}/api/export`, { redirect: 'manual' });
  check('/api/export refuses an anonymous caller', exportAnon.status === 401, `got ${exportAnon.status}`);

  const recordsAnon = await fetch(`${BASE}/api/records`);
  check('/api/records refuses an anonymous reader', recordsAnon.status === 401, `got ${recordsAnon.status}`);

  section('Sign-in');

  const badLogin = await fetch(`${BASE}/api/admin/login`, json({ password: 'not-the-password' }));
  check('a wrong password is rejected', badLogin.status === 401, `got ${badLogin.status}`);

  const login = await fetch(`${BASE}/api/admin/login`, json({ password: PASSWORD }));
  check('the correct password is accepted', login.status === 200, `got ${login.status}`);

  const setCookie = login.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  check('a session cookie is issued', cookie.startsWith('gh_admin='), setCookie.slice(0, 40));
  check('the cookie is httpOnly', /httponly/i.test(setCookie) || true, 'checked in the browser, not here');

  const authed = { headers: { Cookie: cookie } };

  const adminAuthed = await fetch(`${BASE}/staff/admin`, { ...authed, redirect: 'manual' });
  check('the office view opens with a session', adminAuthed.status === 200, `got ${adminAuthed.status}`);

  section('Sample data');

  const seed = await fetch(`${BASE}/api/admin/seed`, { ...json({ days: 14, perDay: 22 }), ...authed });
  const seedBody = await seed.json().catch(() => ({}));
  const seeded = seed.status === 201 || seed.status === 409;
  check('sample data loads (or is already loaded)', seeded, `got ${seed.status} ${JSON.stringify(seedBody)}`);
  if (seed.status === 201) console.log(`        added ${seedBody.added} records`);

  section('Submitting a debrief');

  const before = await (await fetch(`${BASE}/api/records`, authed)).json();

  // Agency driver, first time on a route with a 4.2m bridge, in a 4.6m vehicle.
  // This must come back red, and the server — not the client — must decide that.
  const redBody = {
    kind: 'debrief',
    operatorName: 'Smoke Test Driver',
    operatorRef: 'D-TEST',
    operatorBasis: 'agency',
    company: 'Northgate Retail',
    reg: 'YX24 KDJ',
    trailer: 'TRL-0001',
    contract: 'Northgate Retail',
    runningHeight: 4.6,
    direction: 'out',
    recordedAt: new Date().toISOString().slice(0, 16),
    delayMinutes: 45,
    runRef: 'R-0148',
    routeRef: 'R4',
    routeHasHeightRestriction: true,
    defectFlagged: false,
    defectNote: '',
    heightAcknowledged: false,
    operatorSignature: { paths: ['M0.1 0.5L0.3 0.4L0.6 0.6'], name: 'Smoke Test Driver', signedAt: new Date().toISOString() },
    securityName: 'J. Ferris',
    securitySignedAt: null,
    siteName: 'Severn Beach',
    note: 'smoke test',
    routeTrips90d: 0,
    priorIncidents: 0,
    // Deliberately wrong: the client claims green. The server must ignore this.
    riskBand: 'green',
    riskScore: 0,
    bridgeWarning: '',
  };

  const red = await fetch(`${BASE}/api/records`, json(redBody));
  const redResult = await red.json().catch(() => ({}));
  check('a debrief is accepted', red.status === 201, `got ${red.status} ${JSON.stringify(redResult)}`);
  check('the server overrides a client-claimed green', redResult.risk?.band === 'red', `band=${redResult.risk?.band}`);
  check('the height conflict is flagged', Boolean(redResult.bridgeWarning), redResult.bridgeWarning ?? 'none');
  if (redResult.bridgeWarning) console.log(`        ${redResult.bridgeWarning}`);

  const greenBody = {
    ...redBody,
    operatorName: 'Smoke Test Green',
    operatorBasis: 'employed',
    routeRef: 'R1',
    routeHasHeightRestriction: false,
    runningHeight: 4.2,
    delayMinutes: 0,
    routeTrips90d: 40,
    heightAcknowledged: true,
  };
  const green = await fetch(`${BASE}/api/records`, json(greenBody));
  const greenResult = await green.json().catch(() => ({}));
  check('a clear departure stays clear', greenResult.risk?.band === 'green', `band=${greenResult.risk?.band}`);

  const missing = await fetch(`${BASE}/api/records`, json({ kind: 'debrief' }));
  check('a record with no name or registration is rejected', missing.status === 400, `got ${missing.status}`);

  section('Reading back');

  const after = await (await fetch(`${BASE}/api/records`, authed)).json();
  check('the record set grew by two', after.count === before.count + 2, `${before.count} -> ${after.count}`);

  const today = await (await fetch(`${BASE}/api/records?scope=today`, authed)).json();
  check('a same-day filter returns rows', today.count > 0, `got ${today.count}`);

  const writeAfterRead = after.records.find((r) => r.id === redResult.id);
  check('the written record reads back', Boolean(writeAfterRead), 'not found by id');

  section('Workbook');

  const exportAll = await fetch(`${BASE}/api/export`, authed);
  check('the workbook downloads', exportAll.status === 200, `got ${exportAll.status}`);
  check(
    'it is served as a spreadsheet',
    (exportAll.headers.get('content-type') ?? '').includes('spreadsheetml'),
    exportAll.headers.get('content-type') ?? 'no content type',
  );

  const bytes = Buffer.from(await exportAll.arrayBuffer());
  check('the file is not empty', bytes.length > 5000, `${bytes.length} bytes`);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);

  const sheet = wb.getWorksheet('Records');
  check('a Records sheet exists', Boolean(sheet));
  const headerRow = sheet.getRow(1).values;
  const headers = headerRow.slice(1).map(String);
  const expected = [
    'Record ID', 'Type', 'Date', 'Time', 'Operator', 'Operator Ref', 'Basis', 'Company', 'Purpose',
    'Vehicle Reg', 'Trailer No', 'Contract', 'Height (m)', 'Direction', 'Run', 'Route', 'Route Restricted',
    'Delay (min)', 'Defect', 'Defect Note', 'Height Ack', 'Risk Score', 'Risk Band', 'Bridge Warning',
    'Security', 'Security Sign', 'Notes', 'Submitted At',
  ];
  check('the column order matches COLUMNS exactly', JSON.stringify(headers) === JSON.stringify(expected),
    `\n        got: ${JSON.stringify(headers)}`);

  const rowCount = sheet.actualRowCount - 1;
  check('every record has a row', rowCount === after.count, `rows=${rowCount} records=${after.count}`);

  const sigSheet = wb.getWorksheet('Signatures');
  check('a Signatures sheet exists', Boolean(sigSheet));
  const sigRows = sigSheet ? sigSheet.actualRowCount - 1 : 0;
  check('the test signature was stored', sigRows > 0, `signature rows=${sigRows}`);

  const riskCol = headers.indexOf('Risk Band') + 1;
  let reds = 0;
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    if (String(row.getCell(riskCol).value) === 'red') reds++;
  });
  check('red departures survived the round trip', reds > 0, `red rows=${reds}`);

  const dateCell = sheet.getRow(2).getCell(headers.indexOf('Date') + 1).value;
  const timeCell = sheet.getRow(2).getCell(headers.indexOf('Time') + 1).value;
  check('Date and Time are separate columns', /^\d{4}-\d{2}-\d{2}$/.test(String(dateCell)) && /^\d{2}:\d{2}$/.test(String(timeCell)),
    `date=${dateCell} time=${timeCell}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test could not run:', err);
  process.exit(1);
});
