
import { loadEducationalContent } from './pg-state.mjs';
import { getPosts } from './pg-forum.mjs';
import { getProgress } from './pg-progress.mjs';
import { getReports } from './pg-reports.mjs';
import { getUsers } from './pg-admin.mjs';
import { getMetrics } from './pg-metrics.mjs';

function formatDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? '').slice(0, 10);
}

function visibleUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created: formatDate(
      user.created_on ?? user.created
    )
  };
}

// Equivalente PostgreSQL de publicState() en core.mjs.
export async function publicState(user = null) {
  const isAdmin = user?.role === 'admin';

  const [
    educational,
    posts,
    progress,
    reports,
    users,
    metrics
  ] = await Promise.all([
    loadEducationalContent(),
    getPosts(),
    user ? getProgress(user) : Promise.resolve({}),
    isAdmin ? getReports(user) : Promise.resolve([]),
    isAdmin ? getUsers(user) : Promise.resolve(
      user ? [visibleUser(user)] : []
    ),
    isAdmin ? getMetrics() : Promise.resolve(undefined)
  ]);

  return {
    ...educational,
    posts,
    reports,
    users,
    progress: user ? { [user.id]: progress } : {},
    session: user?.id ?? null,
    metrics
  };
}
