import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {bootstrap} from './store'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<div className="grid min-h-screen place-items-center font-sans text-night">Cargando plataforma…</div>)
void bootstrap().then(()=>root.render(<React.StrictMode><App/></React.StrictMode>)).catch(()=>{
 root.render(<main className="mx-auto max-w-xl p-12 text-center"><h1 className="font-display text-4xl">No se pudo iniciar la plataforma</h1><p className="mt-4">Comprueba que el servidor esté ejecutándose. Usa <code>npm run dev</code> desde la carpeta del proyecto.</p></main>)
})
