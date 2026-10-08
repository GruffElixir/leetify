/** @typedef {{kind:string,id:string,index:string,origin:string,url:string}} ProblemRoute */
export function parseProblemUrl(input) {
  try {
    const url = new URL(input, 'https://codeforces.com');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['codeforces.com', 'www.codeforces.com'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const match =
      url.pathname.match(/^\/(contest|gym)\/(\d+)\/problem\/([a-z]\d?)\/?$/i) ||
      url.pathname.match(/^\/(problemset)\/problem\/(\d+)\/([a-z]\d?)\/?$/i);
    if (!match) return null;
    return {
      kind: match[1].toLowerCase(),
      id: match[2],
      index: match[3].toUpperCase(),
      origin: url.origin,
      url: url.href,
    };
  } catch {
    return null;
  }
}
export function problemKey(route) {
  if (!route) throw new Error('A valid problem is required.');
  return `${route.kind === 'gym' ? 'gym' : 'cf'}:${route.id}:${route.index}`;
}
export function problemUrl(route) {
  return route.kind === 'problemset'
    ? `${route.origin}/problemset/problem/${route.id}/${route.index}`
    : `${route.origin}/${route.kind}/${route.id}/problem/${route.index}`;
}
export function submitUrl(route) {
  return `${route.origin}/${route.kind === 'problemset' ? 'problemset' : `${route.kind}/${route.id}`}/submit`;
}
export function statusUrl(route) {
  return route.kind === 'problemset'
    ? `${route.origin}/problemset/status/${route.id}/problem/${route.index}?my=on&order=BY_ARRIVED_DESC`
    : `${route.origin}/${route.kind}/${route.id}/my`;
}
export function canonicalLegacyKey(key) {
  const match = String(key).match(/^(?:contest|problemset|cf):(\d+):([a-z]\d?)$/i);
  if (match) return `cf:${match[1]}:${match[2].toUpperCase()}`;
  const gym = String(key).match(/^gym:(\d+):([a-z]\d?)$/i);
  return gym ? `gym:${gym[1]}:${gym[2].toUpperCase()}` : null;
}
