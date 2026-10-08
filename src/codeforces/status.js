import { parseProblemUrl, problemKey } from '../domain/problem.js';
import { assertCodeforcesPage } from './problem.js';
export function parseStatusRecords(doc, route) {
  assertCodeforcesPage(doc);
  const records = [];
  for (const row of doc.querySelectorAll(
    'tr[data-submission-id],table.status-frame-datatable tr'
  )) {
    const problem = Array.from(row.querySelectorAll('a[href]'))
      .map((a) => parseProblemUrl(new URL(a.getAttribute('href'), route.origin).href))
      .find(Boolean);
    if (!problem || problemKey(problem) !== problemKey(route)) continue;
    const link = Array.from(row.querySelectorAll('a[href]')).find((a) =>
      /\/submission\/\d+/.test(a.getAttribute('href'))
    );
    const submissionId =
      row.dataset.submissionId || link?.getAttribute('href').match(/\/submission\/(\d+)/)?.[1];
    if (!submissionId || !/^\d+$/.test(submissionId)) continue;
    const verdict = (
      row.querySelector('.submissionVerdictWrapper,[submissionid],.verdict')?.textContent || ''
    )
      .trim()
      .replace(/\s+/g, ' ');
    records.push({
      id: submissionId,
      submissionId,
      key: problemKey(route),
      verdict: verdict || 'Pending',
      pending: !verdict || /queue|running|testing|judging|pending/i.test(verdict),
      url: link
        ? new URL(link.getAttribute('href'), route.origin).href
        : `${route.origin}/${route.kind === 'gym' ? 'gym' : 'contest'}/${route.id}/submission/${submissionId}`,
    });
  }
  return records;
}
export function parseSubmissionReceipt(doc, url, { route, baselineIds }) {
  try {
    assertCodeforcesPage(doc);
  } catch (error) {
    return { status: 'unconfirmed', message: error.message };
  }
  const errors = Array.from(doc.querySelectorAll('.error,.error-for__source,.alert-danger'))
    .map((e) => e.textContent.trim())
    .filter(Boolean);
  if (errors.length) return { status: 'rejected', message: errors.join('\n') };
  const receipt = new URL(url, route.origin);
  const direct =
    receipt.origin === route.origin &&
    receipt.pathname.match(/^\/(contest|gym)\/(\d+)\/submission\/(\d+)\/?$/);
  if (direct && direct[2] === route.id && (direct[1] === 'gym') === (route.kind === 'gym'))
    return { status: 'confirmed', submissionId: direct[3] };
  if (!Array.isArray(baselineIds))
    return {
      status: 'unconfirmed',
      message:
        'Codeforces did not provide a submission receipt. Check native My submissions before retrying.',
    };
  const fresh = parseStatusRecords(doc, route).filter(
    (record) => !baselineIds.includes(record.submissionId)
  );
  return fresh.length === 1
    ? { status: 'confirmed', submissionId: fresh[0].submissionId }
    : {
        status: 'unconfirmed',
        message:
          'The submission could not be confirmed. Check native My submissions before retrying.',
      };
}
