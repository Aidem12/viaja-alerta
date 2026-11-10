import { useEffect, useState } from 'react'
import { NAV, P, CAUSES, EFFECTS, CHARTS, MATRIX, FACTS } from './data'
import { Label, Mark, Cta, Photo, PageHead, tone } from './ui'
import { ModuleCard, ProgressBar, Modules, Recommendations, Progress } from './learn'
import { Account } from './account'
import { Admin } from './admin'
import { Forum } from './forum'
import { currentUser, logOut, moduleStats, sendReport, recordVisit, useDB } from './store'

const PAGES: string[] = [...NAV.map((n) => n[0]), 'problema', 'datos', 'progreso', 'reportar', 'cuenta', 'admin']
// Cada página pertenece a un menú principal
const GROUP: Record<string, string> = { problema: 'inicio', datos: 'inicio', progreso: 'modulos', reportar: 'modulos' }
const SUBS: Record<string, readonly (readonly [string, string])[]> = {
  inicio: [['inicio', 'Inicio'], ['problema', 'El problema'], ['datos', 'Datos']],
  modulos: [['modulos', 'Módulos'], ['progreso', 'Mi progreso'], ['reportar', 'Reportar']],
}

function SubNav({ group, page }: { group: string; page: string }) {
  const items = SUBS[group]
  if (!items) return null
  return (
    <div className="border-b border-rule bg-bone">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6" role="tablist">
        {items.map(([id, l]) => (
          <a key={id} href={`#${id}`} role="tab" aria-selected={page === id}
            className={`whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition ${page === id ? 'border-signal text-night' : 'border-transparent text-mute hover:text-night'}`}>
            {l}
          </a>
        ))}
      </div>
    </div>
  )
}
const readHash = () => window.location.hash.replace('#', '')

function usePage(): [string, string | undefined] {
  const [hash, setHash] = useState(readHash)
  useEffect(() => {
    const on = () => setHash(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const [head, param] = hash.split('/')
  const page = PAGES.includes(head) ? head : 'inicio'
  useEffect(() => {
    const el = hash && !PAGES.includes(head) ? document.getElementById(hash) : null
    if (el) el.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [hash, head])
  return [page, param]
}

/* ---------- INICIO ---------- */
function Home() {
  const d = useDB()
  const completed = d.modules.filter((m) => moduleStats(d, m.id).complete).length
  const first = d.modules.find((m) => !moduleStats(d, m.id).complete) ?? d.modules[0]
  const started = d.modules.some((m) => moduleStats(d, m.id).done > 0)
  return (
    <>
      <section className="relative isolate bg-night text-white">
        <Photo src={P.busFull} alt="Pasajeros dentro de un autobús lleno" className="absolute inset-0 -z-10 size-full opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/60 to-night/30" />
        <div className="mx-auto flex min-h-[min(40rem,85vh)] max-w-7xl flex-col justify-end px-6 pb-16 pt-24">
          <div className="rise">
            <Label light>Plataforma de autoprotección</Label>
            <h1 className="mt-5 max-w-5xl font-display text-[clamp(2.8rem,7.5vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
              {d.site.heroTitle}
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80">{d.site.heroText}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              {first && <Cta href={`#modulos/${first.id}`}>{started ? 'Continuar aprendiendo' : 'Empezar el primer módulo'}</Cta>}
              <Cta href="#datos" ghost>Ver los datos</Cta>
            </div>
          </div>
        </div>
      </section>

      {/* MODULOS */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-4xl font-semibold text-night">Módulos</h2>
          <span className="text-sm text-mute">Completados: {completed} de {d.modules.length}</span>
        </div>
        <div className="mt-3"><ProgressBar done={completed} total={d.modules.length} /></div>
        <div className="mt-8 grid gap-5 min-[800px]:grid-cols-3">
          {d.modules.map((m) => <ModuleCard key={m.id} id={m.id} />)}
        </div>
        <div className="mt-5 grid gap-5 min-[800px]:grid-cols-2">
          {[
            ['Recomendaciones', 'Consulta qué hacer en cada momento del viaje.', 'Ver recomendaciones', '#recomendaciones'],
            ['Comunidad', 'Lee y comparte lo que sucede en distintas rutas.', 'Ir al foro', '#foro'],
          ].map(([t, desc, cta, href]) => (
            <div key={t} className="rounded-2xl bg-night p-6 text-white">
              <h3 className="font-display text-2xl font-semibold">{t}</h3>
              <p className="mt-2 text-white/70">{desc}</p>
              <a href={href} className="mt-5 inline-block rounded-full border border-signal px-6 py-2.5 text-sm font-bold text-signal transition hover:bg-signal hover:text-night">{cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* BIG NUMBERS */}
      <section className="bg-night text-white">
        <div className="mx-auto grid max-w-7xl gap-px bg-white/10 px-0 min-[900px]:grid-cols-3">
          {[['66%', 'sufrió un robo o intento de bolseo'], ['82%', 'presencia tácticas de distracción'], ['12%', 'presentó denuncia formal']].map(([n, t]) => (
            <div key={n} className="bg-night px-6 py-10">
              <p className="font-display text-7xl font-semibold tracking-tight text-signal">{n}</p>
              <p className="mt-2 max-w-[16rem] text-white/70">{t}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto max-w-7xl px-6 pb-6 pt-3 font-mono text-[0.68rem] uppercase tracking-wider text-white/40">
          Encuesta a 50 estudiantes · 2026 · muestra no probabilística
        </p>
      </section>

      {/* QUE ES EL BOLSEO */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 min-[1000px]:grid-cols-12">
        <div className="min-[1000px]:col-span-5">
          <Label>Qué es el bolseo</Label>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-none tracking-tight text-night min-[1000px]:text-6xl">
            Cuatro manos, <em className="font-normal text-primary">cinco segundos</em>.
          </h2>
          <div className="mt-6 h-1 w-14 bg-signal" />
          <p className="mt-8 text-lg leading-relaxed text-ink/85">
            Sustracción del teléfono sin violencia evidente, aprovechando la aglomeración. Suelen actuar en
            grupo: uno distrae, otro extrae, otro encubre y otro escapa.
          </p>
          <p className="mt-4 leading-relaxed text-mute">
            La víctima casi siempre se entera cuando el equipo ya no está. Por eso la prevención cuenta más
            que la reacción.
          </p>
          <a href="#problema" className="mt-8 inline-block font-semibold text-alert transition hover:translate-x-1 hover:text-night">
            Entender el problema →
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 min-[1000px]:col-span-7 min-[1000px]:pl-8">
          {[
            [P.busBlur, 'Pasajeros en un autobús', 'aspect-[4/5]', 'Distrae'],
            [P.phoneHand, 'Persona usando un smartphone', 'aspect-square mt-10', 'Extrae'],
            [P.busSeats, 'Asientos de autobús', 'aspect-square -mt-10', 'Encubre'],
            [P.redBus, 'Autobús rojo en la calle', 'aspect-[4/5]', 'Escapa'],
          ].map(([src, alt, cls, tag]) => (
            <figure key={src} className={`group relative overflow-hidden rounded-2xl ${cls}`}>
              <Photo src={src} alt={alt} className="size-full transition duration-500 group-hover:scale-105" />
              <figcaption className="absolute bottom-3 left-3 rounded-full bg-night/80 px-3 py-1 font-mono text-xs uppercase tracking-wider text-signal">
                {tag}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CARDS */}
      <section className="bg-bone py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-night min-[1000px]:text-6xl">
            Explora el sitio <em className="font-normal text-primary">en imágenes</em>
          </h2>
          <div className="mt-12 grid gap-5 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-4">
            {[
              ['problema', 'El problema', 'Cinco causas y sus efectos.', P.puebla2],
              ['datos', 'Datos', 'Qué respondieron 50 estudiantes.', P.manPhone],
              ['modulos', 'Módulos', 'Decide, mira la consecuencia, aprende.', P.student],
              ['recomendaciones', 'Recomendaciones', 'Qué hacer en cada momento.', P.workshop],
            ].map(([id, t, desc, img]) => (
              <a key={id} href={`#${id}`} className="group relative isolate block aspect-[3/4] overflow-hidden rounded-2xl bg-night">
                <Photo src={img} alt="" className="absolute inset-0 -z-10 size-full transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/30 to-transparent" />
                <div className="flex h-full flex-col justify-end p-6 text-white">
                  <h3 className="font-display text-3xl font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-white/75">{desc}</p>
                  <span className="mt-3 text-signal transition group-hover:translate-x-1">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FACTS */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-24 min-[900px]:grid-cols-3">
        {FACTS.map(([n, t]) => (
          <div key={n} className="border-t-4 border-signal pt-5">
            <p className="font-display text-6xl font-semibold text-primary">{n}</p>
            <p className="mt-2 text-mute">{t}</p>
          </div>
        ))}
      </section>
    </>
  )
}

/* ---------- PROBLEMA ---------- */
function Problem() {
  return (
    <>
      <PageHead label="El problema" title="Un delito" em="silencioso" img={P.busMan}
        text="Ocurre en traslados cotidianos y se nota hasta que el equipo ya no está. Estas son sus cinco causas, confirmadas con encuesta y observación en paraderos." />
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-20">
        {CAUSES.map((c, i) => (
          <article key={c.n} className={`grid overflow-hidden rounded-3xl bg-bone min-[900px]:grid-cols-2 ${i % 2 ? 'min-[900px]:[&>div:first-child]:order-2' : ''}`}>
            <div className="relative min-h-72">
              <Photo src={c.img} alt={c.title} className="absolute inset-0 size-full" />
              <span className="absolute left-5 top-5 rounded-full bg-night px-3 py-1 font-mono text-sm text-signal">{c.n}</span>
            </div>
            <div className="flex flex-col justify-center p-8 min-[1000px]:p-14">
              <h2 className="font-display text-4xl font-semibold text-night min-[1000px]:text-5xl">{c.title}</h2>
              <p className="mt-4 text-lg text-mute">{c.text}</p>
              <p className="mt-8 flex items-baseline gap-4 border-t border-rule pt-6">
                <span className="font-display text-6xl font-semibold text-alert">{c.stat}</span>
                <span className="max-w-[14rem] text-sm text-mute">{c.statText}</span>
              </p>
            </div>
          </article>
        ))}
      </section>
      <section className="bg-night py-20 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <Label light>Efectos</Label>
          <h2 className="mt-3 font-display text-4xl font-semibold min-[1000px]:text-6xl">
            Lo que se pierde <em className="font-normal text-signal">además del teléfono</em>
          </h2>
          <div className="mt-10 grid gap-4 min-[800px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {EFFECTS.map(([t, d], i) => (
              <div key={t} className="rounded-2xl border border-white/15 p-6">
                <span className="font-mono text-signal">0{i + 1}</span>
                <h3 className="mt-3 font-display text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-white/65">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 border-l-4 border-signal pl-5 font-display text-2xl italic text-white/90">
            Resultado: deterioro de la calidad de vida y el bienestar de los estudiantes.
          </p>
        </div>
      </section>
    </>
  )
}

/* ---------- DATOS ---------- */
function Data() {
  const [k, setK] = useState('experiencia')
  const c = CHARTS[k]
  return (
    <>
      <PageHead label="Datos" title="Lo que respondieron" em="50 estudiantes" img={P.busBlur}
        text="94% tiene entre 18 y 23 años; 58% mujeres, 38% hombres, 4% prefirió no decir. Elige un tema y mira las barras." />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p role="note" className="mb-7 rounded-xl border border-signal bg-signal/15 p-4 text-sm text-night">Los porcentajes se conservaron del prototipo de Figma. Son datos ilustrativos pendientes de verificación documental; no representan estadísticas oficiales de la BUAP.</p>
        <div className="flex flex-wrap gap-2" role="tablist">
          {Object.entries(CHARTS).map(([id, v]) => (
            <button
              key={id}
              role="tab"
              aria-selected={k === id}
              onClick={() => setK(id)}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                k === id ? 'border-night bg-night text-signal' : 'border-rule hover:border-night'
              }`}
            >
              {v.tab}
            </button>
          ))}
        </div>
        <div key={k} className="rise mt-10 grid items-stretch gap-8 min-[1000px]:grid-cols-12">
          <figure className="relative min-h-80 overflow-hidden rounded-3xl min-[1000px]:col-span-5">
            <Photo src={c.img} alt={c.title} className="absolute inset-0 size-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 p-7 text-white">
              <h2 className="font-display text-4xl font-semibold">{c.title}</h2>
              <p className="mt-2 text-white/80">{c.lead}</p>
            </figcaption>
          </figure>
          <div className="space-y-6 rounded-3xl bg-bone p-8 min-[1000px]:col-span-7 min-[1000px]:p-12">
            {c.bars.map(([label, v, t]) => (
              <div key={label}>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <span className="font-semibold">{label}</span>
                  <span className="font-display text-3xl font-semibold text-night">{v}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-white">
                  <div className={`grow h-full rounded-full ${tone(t)}`} style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bone py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-display text-4xl font-semibold text-night min-[1000px]:text-5xl">
            Qué funciones <em className="font-normal text-primary">les gustarían más</em>
          </h2>
          <div className="mt-10 grid gap-5 min-[800px]:grid-cols-3">
            {[
              ['1', 'Bloquear el menú de apagado sin PIN', P.phone],
              ['2', 'Alarma sonora al desconectar audífonos', P.girlPhones],
              ['3', 'Alerta automática a contactos de emergencia', P.phoneHand],
            ].map(([n, t, img]) => (
              <div key={n} className="overflow-hidden rounded-2xl bg-white">
                <Photo src={img} alt="" className="aspect-[4/3] w-full" />
                <p className="p-5 font-semibold"><span className="mr-2 font-mono text-alert">#{n}</span>{t}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-mute">
            Los resultados describen a la muestra participante (no probabilística, un solo día de aplicación,
            observación de ~20 minutos). Son orientativos y no se generalizan a toda la comunidad universitaria.
          </p>
        </div>
      </section>

      <section className="bg-night py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 min-[1000px]:grid-cols-12">
          <div className="min-[1000px]:col-span-5">
            <Label light>Viabilidad de las medidas</Label>
            <h2 className="mt-3 font-display text-4xl font-semibold min-[1000px]:text-5xl">
              Por qué la solución es <em className="font-normal text-signal">aprender practicando</em>
            </h2>
            <p className="mt-5 text-white/70">
              Se compararon seis medidas de prevención por costo, tiempo, aceptación y viabilidad técnica
              (puntaje sobre 30). Esta plataforma obtuvo el mejor resultado.
            </p>
          </div>
          <div className="space-y-5 min-[1000px]:col-span-7">
            {MATRIX.map(([t, v, win]) => (
              <div key={t}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <span className={win ? 'font-bold text-signal' : ''}>{win && 'Esta plataforma · '}{t}</span>
                  <span className="font-display text-3xl">{v}<span className="text-base text-white/40">/30</span></span>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`grow h-full rounded-full ${win ? 'bg-signal' : 'bg-sky'}`} style={{ width: `${(v / 30) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}


/* ---------- REPORTAR ---------- */
function Contact() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  return (
    <>
      <PageHead label="Reportar" title="Ayúdanos a" em="mapear el riesgo" img={P.nightStop}
        text="Las tácticas cambian. Cuéntanos de forma anónima un nuevo modus operandi, una ruta o un paradero crítico." />
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 min-[1000px]:grid-cols-2">
        <div className="space-y-4">
          <Photo src={P.puebla3} alt="Calle de Puebla" className="aspect-[4/3] w-full rounded-3xl" />
          <p className="text-mute">
            Los reportes sirven para actualizar los contenidos de la plataforma y detectar horarios y
            lugares críticos. No pedimos nombre ni datos personales.
          </p>
        </div>
        {sent ? (
          <div className="rise grid place-items-center rounded-3xl bg-night p-10 text-center text-white">
            <div>
              <Mark className="mx-auto size-16" />
              <h2 className="mt-5 font-display text-4xl">Gracias por avisar</h2>
              <p className="mt-2 text-white/70">Tu reporte ayuda a que otros viajen alerta.</p>
              <button onClick={() => setSent(false)} className="mt-6 text-signal underline">Enviar otro</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              setSending(true); setSendError('')
              void sendReport(new FormData(form))
                .then(() => { setSent(true); form.reset() })
                .catch((err: Error) => setSendError(err.message))
                .finally(() => setSending(false))
            }}
            className="space-y-5 rounded-3xl bg-bone p-8"
          >
            {[['route', 'Ruta o paradero', 'Ej. Ruta 10, cerca de Ciudad Universitaria'], ['time', 'Horario aproximado', 'Ej. 18:30 h']].map(([n, l, ph]) => (
              <label key={n} className="block">
                <span className="text-sm font-semibold">{l}</span>
                <input name={n} required placeholder={ph} className="mt-1.5 w-full rounded-xl border border-rule bg-white px-4 py-3" />
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-semibold">¿Qué táctica observaste?</span>
              <select name="tactic" className="mt-1.5 w-full rounded-xl border border-rule bg-white px-4 py-3">
                <option>Tapón en la puerta</option>
                <option>Empujones o choque corporal</option>
                <option>Objeto tirado al piso</option>
                <option>Rodean al descender</option>
                <option>Otra</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Cuéntanos qué pasó</span>
              <textarea name="story" required rows={4} className="mt-1.5 w-full rounded-xl border border-rule bg-white px-4 py-3" />
            </label>
            <label className="block"><span className="text-sm font-semibold">Evidencia multimedia (opcional)</span>
              <input type="file" name="evidence" accept="image/png,image/jpeg,image/webp,video/mp4" className="mt-2 block w-full text-sm" />
              <span className="mt-1 block text-xs text-mute">PNG, JPG, WEBP o MP4 · máximo 5 MB. Solo el equipo administrador puede acceder al archivo.</span>
            </label>
            {sendError && <p className="rounded-xl bg-alert/10 p-3 text-sm text-alert" role="alert">{sendError}</p>}
            <button disabled={sending} className="w-full rounded-full bg-night px-7 py-3.5 font-bold text-signal transition hover:bg-primary disabled:opacity-60">
              {sending ? 'Enviando…' : 'Enviar reporte anónimo'}
            </button>
          </form>
        )}
      </section>
    </>
  )
}

export default function App() {
  const [active, param] = usePage()
  const [open, setOpen] = useState(false)
  const d = useDB()
  const user = currentUser(d)
  const [apiError, setApiError] = useState('')
  useEffect(() => {
    const handleError = (e: Event) => setApiError(String((e as CustomEvent<string>).detail || 'Error al guardar.'))
    window.addEventListener('viaja-alerta-error', handleError)
    return () => window.removeEventListener('viaja-alerta-error', handleError)
  }, [])
  useEffect(() => recordVisit(active), [active])
  const view = {
    inicio: <Home />, modulos: <Modules param={param} />, recomendaciones: <Recommendations />, problema: <Problem />,
    datos: <Data />, reportar: <Contact />, foro: <Forum />, progreso: <Progress />, cuenta: <Account />, admin: <Admin />,
  }[active]
  const group = GROUP[active] ?? active
  const links: readonly (readonly [string, string])[] = user?.role === 'admin' ? [...NAV, ['admin', 'Admin'] as const] : NAV

  return (
    <div className="overflow-x-clip">
      {apiError && <div role="alert" className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl bg-alert p-4 text-sm text-white shadow-xl"><span>{apiError}</span><button className="shrink-0 font-bold underline" onClick={()=>setApiError('')}>Cerrar</button></div>}
      <header className="sticky top-0 z-50 border-b border-rule bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
          <a href="#inicio" className="flex shrink-0 items-center gap-3 text-night">
            <Mark className="size-11" />
            <span className="leading-none">
              <span className="block font-display text-2xl font-semibold tracking-tight">Viaja Alerta</span>
              <span className="mt-1 block font-mono text-[0.64rem] uppercase tracking-[0.16em] text-mute">
                Autoprotección universitaria
              </span>
            </span>
          </a>
          <nav className="hidden items-center min-[1100px]:flex" aria-label="Principal">
            {links.map(([id, label]) => (
              <a key={id} href={`#${id}`}
                className={`relative px-3 py-3 text-[0.95rem] font-semibold transition-colors hover:text-primary ${group === id ? 'text-primary' : 'text-ink'}`}>
                {label}
                <span className={`absolute inset-x-3 -bottom-px h-[3px] origin-left bg-signal transition-transform ${group === id ? 'scale-x-100' : 'scale-x-0'}`} />
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 min-[1100px]:flex">
            {user ? (
              <>
                <a href="#cuenta" className="text-sm font-semibold text-ink">{user.name.split(' ')[0]}</a>
                <button onClick={logOut} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold hover:border-night">Salir</button>
              </>
            ) : (
              <a href="#cuenta" className="rounded-full bg-night px-5 py-2.5 text-sm font-bold text-signal hover:bg-primary">Entrar</a>
            )}
          </div>
          <button className="rounded-full border border-rule px-4 py-1.5 text-sm font-semibold min-[1100px]:hidden"
            onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Cerrar' : 'Menú'}
          </button>
        </div>
        {open && (
          <nav className="border-t border-rule bg-white px-6 py-3 min-[1100px]:hidden">
            {[...links, ['cuenta', user ? 'Mi cuenta' : 'Entrar'] as const].map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)}
                className="block border-b border-rule/60 py-3 font-display text-xl last:border-0">
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <SubNav group={group} page={active} />
      <main key={active + (param ?? '')} className="rise">{view}</main>

      <footer className="bg-night text-white">
        <div className="overflow-hidden border-b border-white/10 py-5">
          <div className="marquee flex w-max gap-10 font-display text-3xl italic text-white/30">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ['Mochila al frente', 'Oídos abiertos', 'Celular al fondo', 'Lejos de la puerta', 'Viaja alerta'].map((t) => (
                <span key={`${k}${t}`}>{t} <span className="text-signal">●</span></span>
              )),
            )}
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 min-[900px]:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="font-display text-3xl">Viaja Alerta</p>
            <p className="mt-2 max-w-md text-sm text-white/60">
              Plataforma de prevención del robo de celulares en el transporte público · 2026.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV.map(([id, l]) => <a key={id} href={`#${id}`} className="text-white/70 hover:text-signal">{l}</a>)}
            <a href="#cuenta" className="text-white/70 hover:text-signal">Cuenta</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
