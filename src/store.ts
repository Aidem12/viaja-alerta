
import { useSyncExternalStore } from 'react'
import { seed } from './seed'

// ============================================================
// Tipos de datos
// ============================================================

export type Opt = {
  text: string
  good: boolean
  consequence: string
  feedback: string
}

export type Situation = {
  id: string
  moduleId: string
  where: string
  img: string
  q: string
  opts: Opt[]
}

export type Module = {
  id: string
  tag: string
  title: string
  desc: string
}

export type Tip = {
  id: string
  moment: string
  title: string
  text: string
  img: string
}

export type Evidence = {
  id: string
  name: string
  mime: string
  bytes: number
}

export type Report = {
  id: string
  route: string
  time: string
  tactic: string
  story: string
  date: string
  status: 'nuevo' | 'revisado'
  evidence?: Evidence | null
  publishedAt?: string
  publicPostId?: string
}

export type Reply = {
  id: string
  author: string
  text: string
  date: string
}

export type Post = {
  id: string
  author: string
  route: string
  title: string
  text: string
  date: string
  replies: Reply[]
}

export type User = {
  id: string
  name: string
  email: string
  role: 'alumno' | 'admin'
  created: string
}

export type Metrics = {
  views: Record<string, number>
  answers: number
  reports: number
}

export type DB = {
  site: {
    heroTitle: string
    heroText: string
  }
  modules: Module[]
  situations: Situation[]
  tips: Tip[]
  reports: Report[]
  posts: Post[]
  users: User[]
  progress: Record<string, Record<string, boolean>>
  session: string | null
  metrics?: Metrics
}

// ============================================================
// Estado global
// ============================================================

export const MOMENTS = [
  'Antes de subir',
  'Dentro de la unidad',
  'Al bajar',
  'Si ocurre un robo'
]

const GUEST_KEY = 'viaja-alerta-guest-progress-v2'

function guestProgress(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}')
  } catch {
    return {}
  }
}

let db: DB = {
  ...seed(),
  users: [],
  reports: [],
  session: null,
  progress: {
    guest: guestProgress()
  }
}

let loaded = false

const subs = new Set<() => void>()

const emit = () => {
  subs.forEach(fn => fn())
}

function setDB(next: DB) {
  db = next
  emit()
}

export const useDB = () =>
  useSyncExternalStore(
    cb => {
      subs.add(cb)
      return () => {
        subs.delete(cb)
      }
    },
    () => db
  )

export const uid = () => crypto.randomUUID()

export const currentUser = (d: DB) =>
  d.users.find(u => u.id === d.session) ?? null

export const progressOf = (d: DB) =>
  d.progress[d.session ?? 'guest'] ?? {}

// ============================================================
// Estadísticas de módulos
// ============================================================

export function moduleStats(d: DB, moduleId: string) {
  const sits = d.situations.filter(
    s => s.moduleId === moduleId
  )

  const p = progressOf(d)

  const done = sits.filter(
    s => s.id in p
  ).length

  const good = sits.filter(
    s => p[s.id]
  ).length

  return {
    total: sits.length,
    done,
    good,
    complete: sits.length > 0 && done === sits.length
  }
}

// ============================================================
// Comunicación con la API
// ============================================================

export async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined
      ? {}
      : { 'Content-Type': 'application/json' },
    body: body === undefined
      ? undefined
      : JSON.stringify(body)
  })

  const result = await response.json().catch(() => ({
    error: 'Respuesta inesperada del servidor.'
  }))

  if (!response.ok) {
    throw new Error(
      result.error || `Error HTTP ${response.status}`
    )
  }

  return result as T
}

export function errorNotice(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'No se pudo guardar el cambio.'

  window.dispatchEvent(
    new CustomEvent('viaja-alerta-error', {
      detail: message
    })
  )
}

// ============================================================
// Carga del estado desde Neon
// ============================================================

export async function reload() {
  const next = await api<DB>('/state')

  if (!next.session) {
    next.progress = {
      guest: guestProgress()
    }
  }

  setDB(next)

  return next
}

export async function bootstrap() {
  try {
    await reload()
    loaded = true
  } catch (error) {
    loaded = false

    errorNotice(
      new Error(
        'No se pudo conectar con la API. Inicia el servidor con npm run dev.'
      )
    )

    throw error
  }
}

export const isLoaded = () => loaded

export function recordVisit(page: string) {
  void api('/metrics/view', 'POST', { page })
    .catch(() => {})
}

// ============================================================
// Autenticación
// ============================================================

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<string | null> {
  try {
    await api('/auth/register', 'POST', {
      name,
      email,
      password
    })

    await reload()
    return null
  } catch (error) {
    return (error as Error).message
  }
}

export async function logIn(
  email: string,
  password: string
): Promise<string | null> {
  try {
    await api('/auth/login', 'POST', {
      email,
      password
    })

    await reload()
    return null
  } catch (error) {
    return (error as Error).message
  }
}

export async function logOut() {
  try {
    await api('/auth/logout', 'POST', {})
    await reload()
  } catch (error) {
    errorNotice(error)
  }
}

export async function requestPasswordReset(
  email: string
): Promise<{
  error?: string
  devCode?: string
}> {
  try {
    return await api<{
      devCode?: string
      error?: string
    }>('/auth/request-reset', 'POST', {
      email
    })
  } catch (error) {
    return {
      error: (error as Error).message
    }
  }
}

export async function resetPassword(
  email: string,
  code: string,
  password: string
): Promise<string | null> {
  try {
    await api('/auth/reset', 'POST', {
      email,
      code,
      password
    })

    return null
  } catch (error) {
    return (error as Error).message
  }
}

// ============================================================
// Progreso educativo
// ============================================================

export function answer(
  sitId: string,
  optionIndex: number
) {
  const sit = db.situations.find(
    s => s.id === sitId
  )

  if (!sit || !sit.opts[optionIndex]) {
    return
  }

  const good = sit.opts[optionIndex].good

  // Invitados: guardar progreso en localStorage.
  if (!db.session) {
    const guest = {
      ...progressOf(db),
      [sitId]: good
    }

    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify(guest)
    )

    setDB({
      ...db,
      progress: { guest }
    })

    return
  }

  // Usuarios registrados: guardar progreso en Neon.
  const next = structuredClone(db)

  next.progress[next.session!] ??= {}
  next.progress[next.session!][sitId] = good

  setDB(next)

  void api('/progress/answer', 'POST', {
    situationId: sitId,
    choiceIndex: optionIndex
  }).catch(async error => {
    errorNotice(error)
    await reload()
  })
}

export function resetProgress() {
  if (!db.session) {
    localStorage.removeItem(GUEST_KEY)

    setDB({
      ...db,
      progress: {
        guest: {}
      }
    })

    return
  }

  void api('/progress/reset', 'POST', {})
    .then(reload)
    .catch(errorNotice)
}

// ============================================================
// Administración: sincronización secuencial con Neon
// ============================================================

let adminTimer: ReturnType<typeof setTimeout> | null = null

// Mantiene el orden de las solicitudes administrativas.
let adminSaveQueue: Promise<void> = Promise.resolve()

function adminSnapshot() {
  return {
    site: db.site,
    modules: db.modules,
    situations: db.situations,
    tips: db.tips,
    reports: db.reports,
    users: db.users
  }
}

function queueAdminSave(): Promise<void> {
  // Capturar una copia independiente para evitar que
  // futuras ediciones modifiquen esta solicitud.
  const snapshot = structuredClone(adminSnapshot())

  const task = adminSaveQueue
    .catch(() => {
      // Permitir nuevos guardados tras un error anterior.
    })
    .then(async () => {
      await api(
        '/admin/state',
        'POST',
        snapshot
      )
    })

  adminSaveQueue = task

  return task
}

export function adminUpdate(fn: (d: DB) => void) {
  if (currentUser(db)?.role !== 'admin') {
    errorNotice(
      new Error('Debes ser administrador.')
    )
    return
  }

  const next = structuredClone(db)

  fn(next)
  setDB(next)

  // Reiniciar el temporizador de autoguardado.
  if (adminTimer) {
    clearTimeout(adminTimer)
  }

  adminTimer = setTimeout(() => {
    adminTimer = null

    void queueAdminSave().catch(async error => {
      errorNotice(error)

      try {
        await reload()
      } catch (reloadError) {
        errorNotice(reloadError)
      }
    })
  }, 550)
}

// ============================================================
// Reportes y evidencias
// ============================================================

function serializeEvidence(
  file: File
): Promise<{
  name: string
  mime: string
  data: string
}> {
  return new Promise((resolve, reject) => {
    if (file.size > 5_000_000) {
      reject(
        new Error(
          'La evidencia debe pesar menos de 5 MB.'
        )
      )
      return
    }

    const reader = new FileReader()

    reader.onload = () => resolve({
      name: file.name,
      mime: file.type,
      data: String(reader.result).split(',')[1] || ''
    })

    reader.onerror = () => reject(
      new Error('No se pudo leer la evidencia.')
    )

    reader.readAsDataURL(file)
  })
}

export async function sendReport(form: FormData) {
  const evidence = form.get('evidence')

  const body = {
    route: String(form.get('route') || ''),
    time: String(form.get('time') || ''),
    tactic: String(form.get('tactic') || ''),
    story: String(form.get('story') || ''),
    ...(
      evidence instanceof File && evidence.size
        ? {
            evidence: await serializeEvidence(evidence)
          }
        : {}
    )
  }

  await api('/reports', 'POST', body)

  if (
    db.session &&
    currentUser(db)?.role === 'admin'
  ) {
    await reload()
  }
}

// ============================================================
// Foro
// ============================================================

export async function createPost(body: {
  route: string
  title: string
  text: string
  anonymous?: boolean
}) {
  await api('/posts', 'POST', body)
  await reload()
}

export async function replyPost(
  postId: string,
  text: string
) {
  await api(
    `/posts/${encodeURIComponent(postId)}/replies`,
    'POST',
    { text }
  )

  await reload()
}

export async function deletePost(postId: string) {
  await api(
    `/posts/${encodeURIComponent(postId)}`,
    'DELETE'
  )

  await reload()
}

// ============================================================
// Administración de reportes
// ============================================================

export async function publishReport(
  reportId: string,
  summary: string
) {
  await api(
    `/admin/reports/${encodeURIComponent(reportId)}/publish`,
    'POST',
    { summary }
  )

  await reload()
}

export async function deleteReport(reportId: string) {
  await api(
    `/admin/reports/${encodeURIComponent(reportId)}`,
    'DELETE'
  )

  await reload()
}

// ============================================================
// Eliminación segura de usuarios
// ============================================================

export async function deleteUser(
  userId: string
): Promise<void> {
  // Validar sesión administrativa.
  if (currentUser(db)?.role !== 'admin') {
    throw new Error('Debes ser administrador.')
  }

  // Impedir que el administrador elimine su propia cuenta.
  if (db.session === userId) {
    throw new Error(
      'No puedes eliminar tu propia cuenta.'
    )
  }

  // Si existe un autoguardado pendiente, ejecutarlo
  // antes de iniciar la eliminación.
  if (adminTimer) {
    clearTimeout(adminTimer)
    adminTimer = null

    await queueAdminSave()
  }

  // Esperar las solicitudes administrativas anteriores.
  await adminSaveQueue

  // Solicitar la eliminación al backend PostgreSQL.
  await api(
    `/admin/users/${encodeURIComponent(userId)}`,
    'DELETE'
  )

  // Actualizar la lista de usuarios desde Neon.
  await reload()
}
