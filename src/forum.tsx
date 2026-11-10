import { useState } from 'react'
import { P } from './data'
import { PageHead } from './ui'
import { createPost, currentUser, deletePost, replyPost, errorNotice, useDB } from './store'

const input = 'mt-1.5 w-full rounded-xl border border-rule bg-white px-4 py-3'

export function Forum() {
  const d = useDB()
  const user = currentUser(d)
  const [route, setRoute] = useState('Todas')
  const [open, setOpen] = useState<string | null>(null)
  const routes = ['Todas', ...Array.from(new Set(d.posts.map((p) => p.route)))]
  const posts = d.posts.filter((p) => route === 'Todas' || p.route === route)
  const isAdmin = user?.role === 'admin'

  return (
    <>
      <PageHead label="Comunidad" title="Lo que pasa en" em="cada ruta" img={P.redBus}
        text="Estudiantes que cuentan lo que vieron en su trayecto: tácticas, horarios y paraderos. Lee, responde y avisa a los demás." />
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 min-[1000px]:grid-cols-12">
        <div className="min-[1000px]:col-span-7">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por ruta">
            {routes.map((r) => (
              <button key={r} role="tab" aria-selected={route === r} onClick={() => setRoute(r)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${route === r ? 'border-night bg-night text-signal' : 'border-rule hover:border-night'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="mt-8 space-y-5">
            {posts.length === 0 && <p className="text-mute">Aún no hay publicaciones para esta ruta.</p>}
            {posts.map((p) => (
              <article key={p.id} className="rounded-2xl bg-bone p-6">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-full bg-night px-3 py-1 font-mono uppercase tracking-wider text-signal">{p.route}</span>
                  <span className="text-mute">{p.author} · {p.date}</span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold text-night">{p.title}</h2>
                <p className="mt-2 text-ink/85">{p.text}</p>
                <div className="mt-4 flex gap-5 text-sm font-semibold">
                  <button className="text-primary" onClick={() => setOpen(open === p.id ? null : p.id)}>
                    {p.replies.length} {p.replies.length === 1 ? 'respuesta' : 'respuestas'} {open === p.id ? '−' : '+'}
                  </button>
                  {isAdmin && (
                    <button className="text-alert" onClick={() => { if(confirm('¿Eliminar publicación?')) void deletePost(p.id).catch(errorNotice) }}>Eliminar</button>
                  )}
                </div>
                {open === p.id && (
                  <div className="mt-4 space-y-3 border-t border-rule pt-4">
                    {p.replies.map((r) => (
                      <div key={r.id} className="rounded-xl bg-white p-4 text-sm">
                        <p className="text-xs text-mute">{r.author} · {r.date}</p>
                        <p className="mt-1">{r.text}</p>
                      </div>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        const text = String(new FormData(e.currentTarget).get('text') ?? '').trim()
                        if (!text) return
                        void replyPost(p.id, text).catch(errorNotice)
                        e.currentTarget.reset()
                      }}
                      className="flex gap-2"
                    >
                      <input name="text" required placeholder="Escribe una respuesta" className="w-full rounded-xl border border-rule bg-white px-4 py-2.5 text-sm" />
                      <button className="rounded-full bg-night px-5 text-sm font-bold text-signal hover:bg-primary">Enviar</button>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const g = (k: string) => String(f.get(k) ?? '').trim()
            void createPost({route:g('route'),title:g('title'),text:g('text'),anonymous:Boolean(f.get('anon'))}).then(() => {setRoute('Todas')}).catch(errorNotice)
            e.currentTarget.reset()
          }}
          className="h-fit space-y-4 rounded-3xl bg-night p-7 text-white min-[1000px]:sticky min-[1000px]:top-28 min-[1000px]:col-span-5"
        >
          <h2 className="font-display text-3xl font-semibold">Cuenta lo que viste</h2>
          <label className="block text-sm font-semibold">Ruta
            <input name="route" required placeholder="Ej. Ruta 10" className={`${input} text-ink`} />
          </label>
          <label className="block text-sm font-semibold">Título
            <input name="title" required className={`${input} text-ink`} />
          </label>
          <label className="block text-sm font-semibold">Qué pasó
            <textarea name="text" required rows={4} className={`${input} text-ink`} />
          </label>
          {user && (
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="anon" /> Publicar como anónimo
            </label>
          )}
          <button className="w-full rounded-full bg-signal px-7 py-3.5 font-bold text-night transition hover:bg-white">Publicar</button>
          {!user && <p className="text-xs text-white/60">Publicas como anónimo. <a href="#cuenta" className="underline">Inicia sesión</a> para usar tu nombre.</p>}
        </form>
      </section>
    </>
  )
}
