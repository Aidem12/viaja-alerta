import { useState } from 'react'
import { PageHead } from './ui'
import { P } from './data'
import { MOMENTS, currentUser, uid, adminUpdate as update, deleteReport, publishReport, errorNotice, useDB } from './store'
import type { Module, Situation, Tip } from './store'

const inp = 'w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm'
const btn = 'rounded-full px-4 py-1.5 text-sm font-semibold'
const del = `${btn} border border-rule text-alert hover:border-alert`
const TABS = ['Usuarios', 'Módulos', 'Situaciones', 'Recomendaciones', 'Reportes', 'Métricas', 'Contenido'] as const

export function Admin() {
  const d = useDB()
  const user = currentUser(d)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Usuarios')
  if (user?.role !== 'admin')
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-semibold text-night">Acceso restringido</h1>
        <p className="mt-4 text-mute">Esta sección es solo para administradores.</p>
        <a href="#cuenta" className="mt-6 inline-block rounded-full bg-night px-7 py-3 font-bold text-signal">Iniciar sesión</a>
        <p className="mt-6 text-xs text-mute">Un administrador debe habilitar tu cuenta para acceder al panel.</p>
      </section>
    )
  const newReports = d.reports.filter((r) => r.status === 'nuevo').length
  return (
    <>
      <PageHead label="Administración" title="Panel de" em="gestión" img={P.workshop}
        text="Administra usuarios, módulos, situaciones, recomendaciones y reportes. Los cambios se reflejan al instante en el sitio." />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-full border px-5 py-2 text-sm font-semibold ${tab === t ? 'border-night bg-night text-signal' : 'border-rule hover:border-night'}`}>
              {t}{t === 'Reportes' && newReports > 0 && <span className="ml-2 rounded-full bg-alert px-2 py-0.5 text-xs text-white">{newReports}</span>}
            </button>
          ))}
        </div>
        <div className="mt-8">
          {tab === 'Usuarios' && <Users />}
          {tab === 'Módulos' && <Modules />}
          {tab === 'Situaciones' && <Situations />}
          {tab === 'Recomendaciones' && <Tips />}
          {tab === 'Reportes' && <Reports />}
          {tab === 'Contenido' && <Content />}
          {tab === 'Métricas' && <Metrics />}
        </div>
      </section>
    </>
  )
}

function Users() {
  const d = useDB()
  return (
    <div className="overflow-x-auto rounded-2xl border border-rule">
      <table className="w-full text-left text-sm">
        <thead className="bg-bone text-mute"><tr>{['Nombre', 'Correo', 'Alta', 'Rol', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-rule">
          {d.users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-semibold">{u.name}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{u.created}</td>
              <td className="px-4 py-3">
                <select value={u.role} disabled={u.id === d.session} className={inp + ' !w-auto'}
                  onChange={(e) => update((x) => { x.users.find((y) => y.id === u.id)!.role = e.target.value as 'alumno' | 'admin' })}>
                  <option value="alumno">Alumno</option><option value="admin">Administrador</option>
                </select>
              </td>
              <td className="px-4 py-3 text-right">
                {u.id !== d.session && (
                  <button className={del} onClick={() => confirm(`¿Eliminar a ${u.name}?`) && update((x) => { x.users = x.users.filter((y) => y.id !== u.id); delete x.progress[u.id] })}>Eliminar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Modules() {
  const d = useDB()
  const set = (id: string, k: keyof Module, v: string) => update((x) => { (x.modules.find((m) => m.id === id)![k] as string) = v })
  return (
    <div className="space-y-4">
      {d.modules.map((m) => (
        <div key={m.id} className="grid gap-3 rounded-2xl bg-bone p-5 min-[900px]:grid-cols-[10rem_1fr_2fr_auto]">
          <input className={inp} value={m.tag} onChange={(e) => set(m.id, 'tag', e.target.value)} aria-label="Etiqueta" />
          <input className={inp} value={m.title} onChange={(e) => set(m.id, 'title', e.target.value)} aria-label="Título" />
          <input className={inp} value={m.desc} onChange={(e) => set(m.id, 'desc', e.target.value)} aria-label="Descripción" />
          <button className={del} onClick={() => confirm('¿Eliminar módulo y sus situaciones?') && update((x) => { x.modules = x.modules.filter((y) => y.id !== m.id); x.situations = x.situations.filter((s) => s.moduleId !== m.id) })}>Eliminar</button>
        </div>
      ))}
      <button className={`${btn} bg-night text-signal`} onClick={() => update((x) => { x.modules.push({ id: uid(), tag: 'Nuevo', title: 'Nuevo módulo', desc: 'Descripción del módulo.' }) })}>+ Añadir módulo</button>
    </div>
  )
}

function Situations() {
  const d = useDB()
  const [mid, setMid] = useState(d.modules[0]?.id ?? '')
  const list = d.situations.filter((s) => s.moduleId === mid)
  const edit = (id: string, fn: (s: Situation) => void) => update((x) => fn(x.situations.find((s) => s.id === id)!))
  return (
    <div>
      <select value={mid} onChange={(e) => setMid(e.target.value)} className={inp + ' !w-auto'}>
        {d.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
      <div className="mt-5 space-y-5">
        {list.map((s) => (
          <div key={s.id} className="rounded-2xl bg-bone p-5">
            <div className="grid gap-3 min-[900px]:grid-cols-[14rem_1fr]">
              <input className={inp} value={s.where} onChange={(e) => edit(s.id, (z) => { z.where = e.target.value })} aria-label="Lugar" />
              <input className={inp} value={s.q} onChange={(e) => edit(s.id, (z) => { z.q = e.target.value })} aria-label="Pregunta" />
            </div>
            <div className="mt-4 grid gap-4 min-[900px]:grid-cols-2">
              {s.opts.map((o, n) => (
                <div key={n} className="space-y-2 rounded-xl bg-white p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={o.good} onChange={(e) => edit(s.id, (z) => { z.opts[n].good = e.target.checked })} /> Decisión segura
                  </label>
                  <textarea rows={2} className={inp} value={o.text} placeholder="Decisión" onChange={(e) => edit(s.id, (z) => { z.opts[n].text = e.target.value })} />
                  <textarea rows={2} className={inp} value={o.consequence} placeholder="Consecuencia" onChange={(e) => edit(s.id, (z) => { z.opts[n].consequence = e.target.value })} />
                  <textarea rows={2} className={inp} value={o.feedback} placeholder="Retroalimentación" onChange={(e) => edit(s.id, (z) => { z.opts[n].feedback = e.target.value })} />
                </div>
              ))}
            </div>
            <button className={`${del} mt-4`} onClick={() => confirm('¿Eliminar situación?') && update((x) => { x.situations = x.situations.filter((y) => y.id !== s.id) })}>Eliminar situación</button>
          </div>
        ))}
        {mid && (
          <button className={`${btn} bg-night text-signal`} onClick={() => update((x) => {
            x.situations.push({ id: uid(), moduleId: mid, where: 'Nuevo lugar', img: P.busFull, q: 'Describe la situación.',
              opts: [{ text: 'Decisión de riesgo', good: false, consequence: 'Qué ocurre.', feedback: 'Qué aprender.' }, { text: 'Decisión segura', good: true, consequence: 'Qué ocurre.', feedback: 'Qué aprender.' }] })
          })}>+ Añadir situación</button>
        )}
      </div>
    </div>
  )
}

function Tips() {
  const d = useDB()
  const set = (id: string, k: keyof Tip, v: string) => update((x) => { (x.tips.find((t) => t.id === id)![k] as string) = v })
  return (
    <div className="space-y-4">
      {d.tips.map((t) => (
        <div key={t.id} className="grid gap-3 rounded-2xl bg-bone p-5 min-[900px]:grid-cols-[12rem_1fr_2fr_auto]">
          <select className={inp} value={t.moment} onChange={(e) => set(t.id, 'moment', e.target.value)}>{MOMENTS.map((m) => <option key={m}>{m}</option>)}</select>
          <input className={inp} value={t.title} onChange={(e) => set(t.id, 'title', e.target.value)} aria-label="Título" />
          <input className={inp} value={t.text} onChange={(e) => set(t.id, 'text', e.target.value)} aria-label="Texto" />
          <button className={del} onClick={() => update((x) => { x.tips = x.tips.filter((y) => y.id !== t.id) })}>Eliminar</button>
        </div>
      ))}
      <button className={`${btn} bg-night text-signal`} onClick={() => update((x) => { x.tips.push({ id: uid(), moment: MOMENTS[0], title: 'Nueva recomendación', text: 'Describe el hábito.', img: P.busFull }) })}>+ Añadir recomendación</button>
    </div>
  )
}

function Reports() {
  const d = useDB()
  if (!d.reports.length) return <p className="text-mute">Aún no hay reportes.</p>
  return (
    <div className="space-y-4">
      {d.reports.map((r) => (
        <article key={r.id} className="rounded-2xl bg-bone p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{r.tactic} · {r.route} · {r.time}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === 'nuevo' ? 'bg-alert/15 text-alert' : 'bg-ok/15 text-ok'}`}>{r.publishedAt ? 'Publicado' : r.status === 'nuevo' ? 'Nuevo' : 'Revisado'}</span>
          </div>
          <p className="mt-2 text-mute">{r.story}</p>
          <p className="mt-1 text-xs text-mute">{r.date}</p>
          {r.evidence && <a className="mt-3 inline-block text-sm font-semibold text-primary underline" href={`/api/evidence/${r.evidence.id}`} target="_blank" rel="noreferrer">Ver evidencia: {r.evidence.name} ({Math.round(r.evidence.bytes / 1024)} KB)</a>}
          <div className="mt-3 flex gap-2">
            {r.status === 'nuevo' && <button className={`${btn} bg-night text-signal`} onClick={() => update((x) => { x.reports.find((y) => y.id === r.id)!.status = 'revisado' })}>Marcar revisado</button>}
            {!r.publishedAt && <button className={`${btn} border border-ok text-ok`} onClick={() => {
              const summary = prompt('Redacta un resumen público sin nombres, teléfonos ni otros datos personales. El texto será visible en Comunidad:')
              if(summary) void publishReport(r.id, summary).catch(errorNotice)
            }}>Validar y publicar alerta</button>}
            <button className={del} onClick={() => { if(confirm('¿Eliminar reporte y evidencia adjunta?')) void deleteReport(r.id).catch(errorNotice) }}>Eliminar</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Content() {
  const d = useDB()
  return (
    <div className="max-w-3xl space-y-4 rounded-2xl bg-bone p-6">
      <p className="text-sm text-mute">Texto principal de la portada.</p>
      <label className="block"><span className="text-sm font-semibold">Título</span>
        <input className={inp} value={d.site.heroTitle} onChange={(e) => update((x) => { x.site.heroTitle = e.target.value })} /></label>
      <label className="block"><span className="text-sm font-semibold">Descripción</span>
        <textarea rows={3} className={inp} value={d.site.heroText} onChange={(e) => update((x) => { x.site.heroText = e.target.value })} /></label>
    </div>
  )
}

function Metrics() {
  const d = useDB()
  const views = Object.entries(d.metrics?.views ?? {}).sort((a,b) => b[1]-a[1])
  const summary = [
    ['Visitas registradas', String(views.reduce((n,[,v])=>n+v,0))],
    ['Respuestas a simulaciones', String(d.metrics?.answers ?? 0)],
    ['Reportes recibidos', String(d.metrics?.reports ?? 0)],
    ['Nuevos por revisar', String(d.reports.filter(r=>r.status==='nuevo').length)],
  ]
  return <div className="space-y-8">
    <div className="grid gap-4 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
      {summary.map(([label,n])=><div key={label} className="rounded-2xl bg-night p-6 text-white"><p className="font-display text-4xl text-signal">{n}</p><p className="mt-2 text-sm text-white/70">{label}</p></div>)}
    </div>
    <div className="rounded-2xl bg-bone p-6"><h3 className="font-display text-2xl">Secciones más consultadas</h3>
      {views.map(([name,n])=><div key={name} className="mt-3 flex justify-between border-b border-rule py-2 text-sm"><span>{name}</span><b>{n}</b></div>)}
      {!views.length && <p className="mt-3 text-sm text-mute">Sin visitas registradas todavía.</p>}
    </div>
    <a href="/api/admin/reports.csv" className="inline-flex rounded-full bg-night px-6 py-3 font-semibold text-signal">Descargar reportes CSV</a>
    <p className="text-xs text-mute">Métricas básicas del servidor. No rastreamos ubicación precisa ni identificadores personales de visitantes.</p>
  </div>
}
