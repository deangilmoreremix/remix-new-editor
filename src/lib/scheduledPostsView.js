// Pure view helpers for the Smart Video Scheduler: grouping, titles, counts.
// Kept free of DOM and network access so they can be unit-tested.

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Only http(s) links are ever rendered as hrefs (the value comes from a platform response). */
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export function postTitle(post) {
  const p = post?.payload || {};
  const text = String(p.title || p.caption || p.description || '').trim();
  if (!text) return 'Untitled post';
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** Group posts by local calendar day, days and posts in ascending run_at order. */
export function groupPostsByDay(posts, locale) {
  const sorted = [...(posts || [])].sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
  const days = new Map();
  for (const post of sorted) {
    const when = new Date(post.run_at);
    if (Number.isNaN(when.getTime())) continue;
    const key = dayKey(when);
    if (!days.has(key)) {
      days.set(key, {
        key,
        label: when.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        posts: [],
      });
    }
    days.get(key).posts.push(post);
  }
  return [...days.values()];
}

export function summarizePosts(posts) {
  const summary = { total: 0, scheduled: 0, inFlight: 0, published: 0, failed: 0, cancelled: 0, byPlatform: {} };
  for (const post of posts || []) {
    summary.total += 1;
    if (post.status === 'scheduled') summary.scheduled += 1;
    else if (post.status === 'publishing' || post.status === 'processing') summary.inFlight += 1;
    else if (post.status === 'published') summary.published += 1;
    else if (post.status === 'failed') summary.failed += 1;
    else if (post.status === 'cancelled') summary.cancelled += 1;
    if (post.status !== 'cancelled') {
      summary.byPlatform[post.platform] = (summary.byPlatform[post.platform] || 0) + 1;
    }
  }
  return summary;
}

export function postLink(post) {
  const result = post?.result || {};
  return safeHttpUrl(result?.output?.url || result?.url);
}
