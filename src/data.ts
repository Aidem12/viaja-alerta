const IMG = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&fit=crop&auto=format&q=80`

export const P = {
  busFull: IMG('1509749837427-ac94a2553d0e', 2000),
  busBlur: IMG('1494515843206-f3117d3f51b7', 1400),
  busSeats: IMG('1589395241612-86d52ec4b9f4', 1000),
  busMan: IMG('1520442922418-8211a6fe605c', 1400),
  girlPhones: IMG('1764072565980-4467b16b503f', 1000),
  manPhone: IMG('1621799479068-c420fa10c948', 1000),
  student: IMG('1759852692971-a2abc6799cbd', 1000),
  backpack: IMG('1551974222-1d49f576a2a4', 1400),
  backpack2: IMG('1617194530354-12ef4151d506', 1000),
  nightStop: IMG('1634428466049-d6d37b51976d', 1600),
  tram: IMG('1600206085398-f6ede93b06f8', 1400),
  puebla1: IMG('1598535989263-cb097f8ac3f0', 1000),
  puebla2: IMG('1600064252184-8d03b69d53e4', 1000),
  puebla3: IMG('1775264049146-084e182f1bbd', 1000),
  redBus: IMG('1689949606349-d216f6c69eb3', 1000),
  phone: IMG('1575655273633-6ac40769c587', 1000),
  phoneHand: IMG('1575657066786-1ee868a8a5ae', 1000),
  workshop: IMG('1524178232363-1fb2b075b655', 1600),
  team: IMG('1606761568499-6d2451b23c66', 1400),
  class: IMG('1561089489-f13d5e730d72', 1000),
}

export const NAV = [
  ['inicio', 'Inicio'],
  ['recomendaciones', 'Recomendaciones'],
  ['foro', 'Comunidad'],
  ['modulos', 'Mi espacio'],
] as const

export const CAUSES = [
  { n: '01', title: 'Aglomeración', text: 'Horas pico y fines de semana: tanto roce que nadie distingue un empujón de un robo.', stat: '82%', statText: 'presencia tácticas de distracción', img: P.busFull },
  { n: '02', title: 'Distracción', text: 'Audífonos y pantalla aíslan los sentidos justo cuando más hay que escuchar.', stat: '48%', statText: 'va con audífonos todo el trayecto', img: P.girlPhones },
  { n: '03', title: 'Resguardo vulnerable', text: 'Bolsillos traseros, chamarras abiertas y bolsas exteriores facilitan la extracción.', stat: '48%', statText: 'guarda el celular en zona de riesgo', img: P.backpack2 },
  { n: '04', title: 'Poca vigilancia', text: 'Paraderos oscuros, sin cámaras ni personal: nadie que pueda intervenir.', stat: '2', statText: 'factores clave: iluminación y vigilancia', img: P.nightStop },
  { n: '05', title: 'Impunidad', text: 'Denunciar parece lento e inútil, así que casi nadie lo hace y el ciclo continúa.', stat: '12%', statText: 'presentó denuncia formal', img: P.puebla2 },
]

export const EFFECTS = [
  ['Economía estudiantil afectada', 'Reponer un celular es un gasto imprevisto para quien no tiene ingresos fijos.'],
  ['Información en riesgo', 'Cuentas, fotos y datos personales quedan expuestos.'],
  ['Incomunicación temporal', 'Sin acceso a contactos, familiares ni compañeros.'],
  ['Miedo en cada traslado', 'Estrés y percepción de inseguridad en la rutina diaria.'],
]

export type Bar = [string, number, string?]
export const CHARTS: Record<string, { tab: string; title: string; lead: string; img: string; bars: Bar[] }> = {
  horario: {
    tab: 'Horarios',
    title: '¿Cuándo viajamos?',
    lead: 'Casi ocho de cada diez traslados ocurren en la mañana o en el atardecer y la noche.',
    img: P.tram,
    bars: [['Atardecer / noche · 16–21 h', 44], ['Mañana · 06–10 h', 34], ['Tarde · 10–16 h', 18], ['Noche tardía', 4]],
  },
  experiencia: {
    tab: 'Robo',
    title: 'Experiencia de robo',
    lead: '66% sufrió un robo o un intento. Solo 4% no conoce ningún caso cercano.',
    img: P.manPhone,
    bars: [['Víctima directa de bolseo', 40, 'alert'], ['Intento detectado a tiempo', 26, 'alert'], ['Conoce a alguien afectado', 30], ['Ningún caso cercano', 4]],
  },
  tacticas: {
    tab: 'Tácticas',
    title: 'Tácticas de distracción presenciadas',
    lead: 'Empujones, "tapones" en la puerta y tropezones intencionados son parte del viaje diario.',
    img: P.busBlur,
    bars: [['Siempre', 42, 'alert'], ['Frecuentemente', 40, 'alert'], ['Casi nunca o nunca', 18]],
  },
  resguardo: {
    tab: 'Resguardo',
    title: '¿Dónde guardas el celular?',
    lead: 'Solo uno de cada ocho lo lleva en un compartimento interior de la mochila.',
    img: P.backpack,
    bars: [['Bolsillos delanteros', 40], ['Bolsillo trasero / chamarra abierta', 32, 'alert'], ['Exterior de mochila o en la mano', 16, 'alert'], ['Compartimento interior', 12, 'ok']],
  },
  audifonos: {
    tab: 'Audífonos',
    title: 'Audífonos o celular en el trayecto',
    lead: 'Casi la mitad viaja aislada del entorno durante todo el recorrido.',
    img: P.girlPhones,
    bars: [['Todo el trayecto', 48, 'alert'], ['De forma ocasional', 30], ['Raramente', 14], ['Lo evita por completo', 8, 'ok']],
  },
  denuncia: {
    tab: 'Denuncia',
    title: '¿Se denuncia?',
    lead: 'La mayoría no denuncia: considera el trámite lento o ineficaz.',
    img: P.puebla1,
    bars: [['No denunció: trámite lento o ineficaz', 60, 'alert'], ['No denunció: temor o falta de pruebas', 26, 'alert'], ['Denunció formalmente', 12, 'ok'], ['No aplica', 2]],
  },
  app: {
    tab: 'Disposición',
    title: '¿Usarías una herramienta de prevención?',
    lead: '82% respalda una solución tecnológica de autoprotección.',
    img: P.phoneHand,
    bars: [['Totalmente dispuesto', 52, 'ok'], ['Probablemente', 30, 'ok'], ['Poco dispuesto', 6], ['Nada dispuesto', 12]],
  },
}

export const TREE = [
  ['Reducir la exposición a la aglomeración', 'Rutas y horarios con menor afluencia', P.busFull],
  ['Atender al entorno', 'Sensibilizar sobre el riesgo de aislarse con audífonos', P.girlPhones],
  ['Resguardar pertenencias', 'Recomendaciones y cursos con simulación de situaciones', P.backpack2],
  ['Vigilancia y denuncia eficaces', 'Más vigilancia en unidades y canal de denuncia digital', P.nightStop],
]

export const MATRIX: [string, number, boolean?][] = [
  ['Cursos de autoprotección con simulación', 25, true],
  ['Rutas y horarios con menor afluencia', 23],
  ['Canal de denuncia digital', 21],
  ['Campañas contra el aislamiento con audífonos', 15],
  ['Recomendaciones para resguardar pertenencias', 15],
  ['Más vigilancia dentro de las unidades', 14],
]

export const FACTS = [
  ['57.4%', 'de los robos en calle o transporte público fue de un teléfono (INEGI, 2022)'],
  ['92.6%', 'de esos robos no se denunció o no derivó en carpeta (ENVIPE 2026)'],
  ['643', 'denuncias en la capital poblana de enero a mayo de 2026'],
]
