import type { ReactNode } from 'react'

export const Label = ({ children, light }: { children: ReactNode; light?: boolean }) => (
  <p className={`font-mono text-[0.72rem] uppercase tracking-[0.18em] ${light ? 'text-signal' : 'text-primary'}`}>
    {children}
  </p>
)

export const Mark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="1" y="1" width="46" height="46" rx="12" fill="#ffc933" />
    <path d="M24 9 11 14v9c0 8.5 5.4 14.6 13 17 7.6-2.4 13-8.5 13-17v-9L24 9Z" fill="#0b1f3a" />
    <rect x="19" y="16" width="10" height="17" rx="2.5" fill="#ffc933" />
    <circle cx="24" cy="30" r="1.2" fill="#0b1f3a" />
  </svg>
)

export const Cta = ({ href, children, ghost }: { href: string; children: ReactNode; ghost?: boolean }) => (
  <a
    href={href}
    className={`rounded-full px-7 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 ${
      ghost ? 'border border-white/50 text-white hover:bg-white/10' : 'bg-signal text-night hover:bg-white'
    }`}
  >
    {children}
  </a>
)

export const Photo = ({ src, alt, className = '' }: { src: string; alt: string; className?: string }) => (
  <img src={src} alt={alt} loading="lazy" className={`bg-primary/20 object-cover ${className}`} />
)

export const tone = (t?: string) => (t === 'alert' ? 'bg-alert' : t === 'ok' ? 'bg-ok' : 'bg-primary')

export function PageHead({ label, title, em, img, text }: { label: string; title: string; em: string; img: string; text: string }) {
  return (
    <section className="relative isolate bg-night text-white">
      <Photo src={img} alt="" className="absolute inset-0 -z-10 size-full opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night to-night/30" />
      <div className="mx-auto max-w-7xl px-6 pb-14 pt-28">
        <Label light>{label}</Label>
        <h1 className="mt-4 max-w-4xl font-display text-6xl font-semibold leading-[0.95] tracking-tight min-[1000px]:text-8xl">
          {title} <em className="font-normal text-signal">{em}</em>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">{text}</p>
      </div>
    </section>
  )
}

