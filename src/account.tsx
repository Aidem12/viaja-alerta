import { useState } from 'react'
import type { FormEvent } from 'react'
import { Mark, Photo } from './ui'
import { P } from './data'
import { currentUser, logIn, logOut, requestPasswordReset, resetPassword, signUp, useDB } from './store'

type Mode = 'login' | 'signup' | 'recover'
const field = 'mt-1.5 w-full rounded-xl border border-rule bg-white px-4 py-3 text-ink'

export function Account() {
  const d = useDB()
  const user = currentUser(d)
  const [mode, setMode] = useState<Mode>('login')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [pending, setPending] = useState(false)
  const [codeRequested, setCodeRequested] = useState(false)
  const [email, setEmail] = useState('')
  const [devCode, setDevCode] = useState('')

  if (user)
    return <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-6 py-20">
      <div className="w-full rounded-3xl bg-night p-10 text-center text-white">
        <Mark className="mx-auto size-16" />
        <h1 className="mt-5 font-display text-4xl">Hola, {user.name}</h1>
        <p className="mt-1 text-white/60">{user.email}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#modulos" className="rounded-full bg-signal px-6 py-3 text-sm font-bold text-night">Ir a los módulos</a>
          <a href="#progreso" className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold">Mi progreso</a>
          {user.role === 'admin' && <a href="#admin" className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold">Administración</a>}
        </div>
        <button onClick={() => void logOut()} className="mt-6 text-sm text-signal underline">Cerrar sesión</button>
      </div>
    </section>

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();setErr('');setOk('');setPending(true)
    const f = new FormData(e.currentTarget)
    const g = (k: string) => String(f.get(k) ?? '').trim()
    try {
      if(mode==='login' || mode==='signup'){
        const result=mode==='login'?await logIn(g('email'),g('password')):await signUp(g('name'),g('email'),g('password'))
        if(result){setErr(result);return}
        window.location.hash='modulos'
      } else if(!codeRequested) {
        const request=await requestPasswordReset(g('email'))
        if(request.error){setErr(request.error);return}
        setEmail(g('email'));setCodeRequested(true);setDevCode(request.devCode||'')
        setOk('Si existe la cuenta, se ha generado un código válido por 15 minutos. En desarrollo consulta la terminal del servidor.')
      } else {
        const result=await resetPassword(email,g('code'),g('password'))
        if(result){setErr(result);return}
        setCodeRequested(false);setMode('login');setOk('Contraseña actualizada. Inicia sesión con tu nueva clave.')
      }
    } catch(e) { setErr((e as Error).message) }
    finally {setPending(false)}
  }

  const titles: Record<Mode,string>={login:'Iniciar sesión',signup:'Crear cuenta',recover:codeRequested?'Restablecer contraseña':'Recuperar contraseña'}
  return <section className="mx-auto grid max-w-6xl items-stretch gap-10 px-6 py-16 min-[900px]:grid-cols-2">
    <div className="relative hidden overflow-hidden rounded-3xl min-[900px]:block">
      <Photo src={P.busFull} alt="Pasajeros en un autobús" className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
      <p className="absolute inset-x-0 bottom-0 p-8 font-display text-4xl text-white">Guarda tu avance y <em className="text-signal">viaja alerta</em>.</p>
    </div>
    <form key={`${mode}-${codeRequested}`} onSubmit={e=>void submit(e)} className="rise space-y-5 rounded-3xl bg-bone p-8 min-[900px]:p-10">
      <h1 className="font-display text-4xl font-semibold text-night">{titles[mode]}</h1>
      {mode==='recover' && <p className="text-sm text-mute">{codeRequested?`Escribe el código asociado a ${email} y tu nueva contraseña.`:'Solicita un código para recuperar tu cuenta. Por seguridad, no se restablece solo con conocer el correo.'}</p>}
      {ok && <p className="rounded-xl bg-ok/15 p-3 text-sm font-semibold text-ok" role="status">{ok}</p>}
      {devCode && <p className="rounded-xl border border-ok p-3 text-sm" role="status">Código de desarrollo: <strong className="break-all">{devCode}</strong></p>}
      {mode==='signup' && <label className="block"><span className="text-sm font-semibold">Nombre</span><input name="name" required autoComplete="name" maxLength={80} className={field} /></label>}
      {!(mode==='recover'&&codeRequested) && <label className="block"><span className="text-sm font-semibold">Correo</span><input name="email" type="email" required autoComplete="email" className={field} /></label>}
      {mode==='recover'&&codeRequested && <label className="block"><span className="text-sm font-semibold">Código de recuperación</span><input name="code" required minLength={20} autoComplete="one-time-code" className={field} /></label>}
      {(mode!=='recover'||codeRequested)&&<label className="block"><span className="text-sm font-semibold">{mode==='recover'?'Nueva contraseña':'Contraseña'}</span><input name="password" type="password" required minLength={mode==='login'?1:8} autoComplete={mode==='login'?'current-password':'new-password'} className={field}/></label>}
      {err && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-sm font-semibold text-alert">{err}</p>}
      <button disabled={pending} className="w-full rounded-full bg-night px-7 py-3.5 font-bold text-signal transition hover:bg-primary disabled:opacity-50">{pending?'Procesando…':mode==='recover'&&!codeRequested?'Solicitar código':titles[mode]}</button>
      <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-primary">
        {mode!=='login'&&<button type="button" onClick={()=>{setMode('login');setErr('');setCodeRequested(false)}}>Ya tengo cuenta</button>}
        {mode!=='signup'&&<button type="button" onClick={()=>{setMode('signup');setErr('');setCodeRequested(false)}}>Crear cuenta</button>}
        {mode==='login'&&<button type="button" onClick={()=>{setMode('recover');setErr('');setCodeRequested(false)}}>Olvidé mi contraseña</button>}
      </div>
    </form>
  </section>
}
