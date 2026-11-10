import { useState } from 'react'
import type { ReactNode } from 'react'
import { Label, PageHead, Cta, Photo } from './ui'

import { P, TREE } from './data'
import { MOMENTS, answer, moduleStats, progressOf, resetProgress, useDB, currentUser } from './store'

export function ModuleCard({ id }: { id: string }) {
  const d = useDB()
  const m = d.modules.find((x) => x.id === id)!
  const st = moduleStats(d, id)
  return (
    <article className="flex flex-col rounded-2xl bg-night p-6 text-white">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-signal">{m.tag}</span>
      <h3 className="mt-2 font-display text-2xl font-semibold">{m.title}</h3>
      <p className="mt-2 flex-1 text-white/70">{m.desc}</p>
      <p className="mt-5 text-sm text-white/50">
        {st.total} situaciones · {st.complete ? 'completado' : st.done ? `${st.done} de ${st.total} resueltas` : 'pendiente'}
      </p>
      <a href={`#modulos/${m.id}`} className="mt-4 self-start rounded-full bg-signal px-6 py-2.5 text-sm font-bold text-night transition hover:bg-white">
        {st.complete ? 'Repasar' : st.done ? 'Continuar' : 'Entrar'}
      </a>
    </article>
  )
}

export function ProgressBar({ done, total, light }: { done: number; total: number; light?: boolean }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full ${light ? 'bg-white/15' : 'bg-rule'}`} role="progressbar" aria-valuenow={done} aria-valuemax={total}>
      <div className="h-full rounded-full bg-signal transition-all duration-700" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  )
}

/* ---------- MÓDULOS ---------- */
export function Modules({ param }: { param?: string }) {
  const d = useDB()
  const m = d.modules.find((x) => x.id === param)
  if (m) return <ModuleRunner key={m.id} moduleId={m.id} />
  const completed = d.modules.filter((x) => moduleStats(d, x.id).complete).length
  return (
    <>
      <PageHead label="Aprendizaje" title="Elige un" em="módulo" img={P.student}
        text="Cada módulo reúne situaciones cortas: decides, ves la consecuencia y recibes una lección. Proteger no es culpar a la víctima: es quitarle ventanas al delito." />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-4xl font-semibold text-night">Módulos</h2>
          <span className="text-sm text-mute">Completados: {completed} de {d.modules.length}</span>
        </div>
        <div className="mt-3"><ProgressBar done={completed} total={d.modules.length} /></div>
        <div className="mt-8 grid gap-5 min-[800px]:grid-cols-3">
          {d.modules.map((x) => <ModuleCard key={x.id} id={x.id} />)}
        </div>
        {d.modules.length === 0 && <p className="mt-8 text-mute">Aún no hay módulos publicados.</p>}
      </section>
    </>
  )
}

function ModuleRunner({ moduleId }: { moduleId: string }) {
  const d = useDB()
  const m = d.modules.find((x) => x.id === moduleId)!
  const sits = d.situations.filter((s) => s.moduleId === moduleId)
  const prog = progressOf(d)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const done = i >= sits.length
  const s = sits[Math.min(i, sits.length - 1)]
  const user = currentUser(d)

  if (sits.length === 0)
    return (
      <section className="mx-auto max-w-3xl px-6 py-24">
        <Label>{m.tag}</Label>
        <h1 className="mt-3 font-display text-5xl font-semibold text-night">{m.title}</h1>
        <p className="mt-4 text-mute">Este módulo aún no tiene situaciones.</p>
        <a href="#modulos" className="mt-6 inline-block font-semibold text-primary">← Volver a módulos</a>
      </section>
    )

  const score = sits.filter((x) => prog[x.id]).length
  const next = d.modules[d.modules.findIndex((x) => x.id === moduleId) + 1]
  const choice = picked !== null ? s.opts[picked] : null

  return (
    <>
      <section className="relative isolate bg-night text-white">
        <Photo src={done ? P.puebla3 : s.img} alt="" className="absolute inset-0 -z-10 size-full opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night to-night/50" />
        <div className="mx-auto max-w-5xl px-6 pb-14 pt-14">
          <a href="#modulos" className="text-sm text-white/70 hover:text-signal">← Todos los módulos</a>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Label light>{m.tag} · {m.title}</Label>
            <div className="flex gap-1.5" aria-label={`Situación ${Math.min(i + 1, sits.length)} de ${sits.length}`}>
              {sits.map((x, n) => (
                <span key={x.id} className={`h-1.5 w-9 rounded-full ${n < i ? 'bg-signal' : n === i && !done ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
          </div>

          {done ? (
            <div className="rise py-8">
              <p className="font-display text-8xl font-semibold text-signal">{score}/{sits.length}</p>
              <p className="mt-4 max-w-xl font-display text-3xl">
                {score === sits.length ? 'Decisiones muy seguras. Compártelo con tus compañeros.' : score >= sits.length / 2 ? 'Vas bien. Repasa las recomendaciones.' : 'Hay mucho que ajustar, pero ya sabes por dónde empezar.'}
              </p>
              {!user && (
                <p className="mt-4 max-w-xl text-white/70">
                  <a href="#cuenta" className="font-semibold text-signal underline">Crea una cuenta</a> para conservar tu progreso en cualquier dispositivo.
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => { setI(0); setPicked(null) }} className="rounded-full border border-white/50 px-7 py-3.5 text-sm font-bold hover:bg-white/10">Repetir módulo</button>
                {next && <Cta href={`#modulos/${next.id}`}>Siguiente: {next.title}</Cta>}
                <Cta href="#progreso" ghost>Ver mi progreso</Cta>
              </div>
            </div>
          ) : (
            <div key={s.id} className="rise">
              <p className="mt-8 font-mono text-sm text-white/60">{s.where}</p>
              <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight min-[900px]:text-5xl">{s.q}</h1>
              <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-signal">1 · Toma una decisión</p>
              <div className="mt-3 grid gap-3 min-[900px]:grid-cols-2">
                {s.opts.map((opt, n) => {
                  const shown = picked !== null
                  const state = !shown ? 'border-white/25 hover:border-signal hover:bg-white/5' : opt.good ? 'border-ok bg-ok/20' : picked === n ? 'border-alert bg-alert/20' : 'border-white/10 opacity-50'
                  return (
                    <button key={n} disabled={shown} onClick={() => { setPicked(n); answer(s.id, n) }}
                      className={`rounded-2xl border p-6 text-left text-lg transition ${state}`}>
                      {opt.text}
                    </button>
                  )
                })}
              </div>

              {choice && (
                <div className="rise mt-6 grid gap-4 min-[900px]:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-6">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-signal">2 · Consecuencia</p>
                    <p className="mt-2 text-lg leading-relaxed">{choice.consequence}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-6 text-ink">
                    <p className={`font-mono text-[0.7rem] uppercase tracking-[0.18em] ${choice.good ? 'text-ok' : 'text-alert'}`}>
                      3 · Retroalimentación · {choice.good ? 'Buena decisión' : 'Cuidado'}
                    </p>
                    <p className="mt-2 text-lg leading-relaxed">{choice.feedback}</p>
                  </div>
                  <div className="min-[900px]:col-span-2">
                    <button onClick={() => { setI(i + 1); setPicked(null) }}
                      className="rounded-full bg-signal px-7 py-3.5 text-sm font-bold text-night transition hover:bg-white">
                      {i === sits.length - 1 ? 'Ver resultado' : 'Siguiente situación'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/* ---------- RECOMENDACIONES ---------- */
export function Recommendations() {
  const d = useDB()
  const [k, setK] = useState(MOMENTS[0])
  const list = d.tips.filter((t) => t.moment === k)
  return (
    <>
      <PageHead label="Recomendaciones" title="Qué hacer en cada" em="momento del viaje" img={P.busBlur}
        text="Hábitos concretos para antes de subir, dentro de la unidad, al bajar y si el robo ocurre." />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap gap-2" role="tablist">
          {MOMENTS.map((m) => (
            <button key={m} role="tab" aria-selected={k === m} onClick={() => setK(m)}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${k === m ? 'border-night bg-night text-signal' : 'border-rule hover:border-night'}`}>
              {m}
            </button>
          ))}
        </div>
        <div key={k} className="rise mt-10 grid gap-5 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-3">
          {list.map((t, n) => (
            <article key={t.id} className="group relative isolate aspect-[4/5] overflow-hidden rounded-2xl">
              <Photo src={t.img} alt="" className="absolute inset-0 -z-10 size-full transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/40 to-transparent" />
              <div className="flex h-full flex-col justify-end p-6 text-white">
                <span className="font-mono text-signal">0{n + 1}</span>
                <h3 className="font-display text-3xl font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm text-white/80">{t.text}</p>
              </div>
            </article>
          ))}
          {list.length === 0 && <p className="text-mute">Sin recomendaciones para este momento.</p>}
        </div>
      </section>

      <section className="bg-bone py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Label>Ejes de prevención</Label>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-semibold text-night min-[1000px]:text-5xl">
            Cuatro frentes <em className="font-normal text-primary">para bajar el riesgo</em>
          </h2>
          <div className="mt-10 grid gap-5 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {TREE.map(([t, desc, img]) => (
              <article key={t} className="overflow-hidden rounded-2xl bg-white">
                <Photo src={img} alt="" className="aspect-[4/3] w-full" />
                <div className="p-6">
                  <h3 className="font-display text-2xl font-semibold text-night">{t}</h3>
                  <p className="mt-2 text-sm text-mute">{desc}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-12 grid items-center gap-6 rounded-3xl bg-night p-8 text-white min-[900px]:grid-cols-[1fr_auto] min-[900px]:p-12">
            <div>
              <Label light>Dato curioso</Label>
              <p className="mt-3 max-w-2xl font-display text-3xl">
                Ninguna persona encuestada lleva un celular secundario ("dummy") ni viaja cerca del conductor.
                Dos medidas sencillas que casi nadie practica.
              </p>
            </div>
            <Cta href="#reportar">Reporta una táctica</Cta>
          </div>
        </div>
      </section>
    </>
  )
}

/* ---------- MI PROGRESO ---------- */
export function Progress() {
  const d = useDB()
  const user = currentUser(d)
  const p = progressOf(d)
  const sits = d.situations
  const done = sits.filter((s) => s.id in p).length
  const good = sits.filter((s) => p[s.id]).length
  const completed = d.modules.filter((m) => moduleStats(d, m.id).complete).length
  return (
    <>
      <PageHead label="Mi progreso" title={user ? `Hola, ${user.name.split(' ')[0]}.` : 'Tu avance'} em="Así vas" img={P.busSeats}
        text="Revisa qué módulos has completado y en qué situaciones tomaste la mejor decisión." />
      <section className="mx-auto max-w-5xl px-6 py-16">
        {!user && (
          <p className="mb-8 rounded-2xl bg-signal/30 p-5 text-night">
            Estás explorando como invitado. <a href="#cuenta" className="font-bold underline">Crea una cuenta o inicia sesión</a> para guardar tu progreso.
          </p>
        )}
        <div className="grid gap-5 min-[700px]:grid-cols-3">
          {[[`${completed}/${d.modules.length}`, 'módulos completados'], [`${done}/${sits.length}`, 'situaciones resueltas'], [done ? `${Math.round((good / done) * 100)}%` : '—', 'decisiones seguras']].map(([n, t]) => (
            <div key={t} className="rounded-2xl bg-night p-7 text-white">
              <p className="font-display text-6xl font-semibold text-signal">{n}</p>
              <p className="mt-1 text-white/70">{t}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-10">
          {d.modules.map((m) => {
            const st = moduleStats(d, m.id)
            return (
              <div key={m.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-3xl font-semibold text-night">{m.title}</h2>
                  <a href={`#modulos/${m.id}`} className="text-sm font-semibold text-primary">{st.complete ? 'Repasar' : 'Continuar'} →</a>
                </div>
                <div className="mt-3"><ProgressBar done={st.done} total={st.total} /></div>
                <ul className="mt-4 divide-y divide-rule rounded-2xl border border-rule">
                  {d.situations.filter((s) => s.moduleId === m.id).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <span>{s.where}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${!(s.id in p) ? 'bg-bone text-mute' : p[s.id] ? 'bg-ok/15 text-ok' : 'bg-alert/15 text-alert'}`}>
                        {!(s.id in p) ? 'Pendiente' : p[s.id] ? 'Decisión segura' : 'A repasar'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        {done > 0 && (
          <button onClick={() => { if (confirm('¿Reiniciar todo tu progreso?')) resetProgress() }}
            className="mt-10 rounded-full border border-rule px-6 py-2.5 text-sm font-semibold text-mute hover:border-alert hover:text-alert">
            Reiniciar progreso
          </button>
        )}
      </section>
    </>
  )
}
