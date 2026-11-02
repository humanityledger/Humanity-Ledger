import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, BookOpen, Users, Zap, Flag, Scale, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Normas de la Comunidad | Humanity Ledger Forum',
  description: 'Las normas y estándares de participación en el foro de Análisis Institucional de Humanity Ledger.',
};

const RULES = [
  {
    n: '01',
    icon: BookOpen,
    title: 'Publicar contenido de valor y con datos de respaldo',
    body: 'Comparte análisis, investigaciones o preguntas técnicas que aporten valor real a los miembros. Cualquier afirmación sobre la actividad en la blockchain debe estar respaldada por evidencia verificable: hashes de transacciones, exploradores de bloques o fuentes de datos auténticas. Se eliminarán los mensajes sin contenido útil o especulaciones sin fundamento.',
    dos: [
      'Compartir hashes de transacciones al citar eventos on-chain',
      'Incluir metodologías y fuentes en posts de investigación',
      'Hacer preguntas técnicas claras y específicas'
    ],
    donts: [
      'Publicar mensajes sin contenido útil o repetitivos',
      'Compartir rumores no verificados como hechos reales',
      'Copiar contenido de otras fuentes sin dar crédito'
    ],
  },
  {
    n: '02',
    icon: Shield,
    title: 'Cero tolerancia a la manipulación del mercado',
    body: 'Está estrictamente prohibido coordinar compras o ventas masivas, publicar señales engañosas de compra/venta, crear cuentas falsas para inflar opiniones o cualquier otra forma de manipulación de mercado. Este foro existe para mejorar la transparencia, no para explotar el mercado.',
    dos: [
      'Compartir análisis independientes y honestos',
      'Declarar si tienes posiciones en los activos que comentas',
      'Reportar cualquier actividad coordinada sospechosa'
    ],
    donts: [
      'Coordinar compras o ventas colectivas en hilos públicos o privados',
      'Publicar señales que sabes que son engañosas',
      'Crear múltiples cuentas para votar a favor de tu propio contenido'
    ],
  },
  {
    n: '03',
    icon: Scale,
    title: 'Respeto mutuo entre todos los participantes',
    body: 'Debate las ideas con argumentos sólidos, pero nunca ataques a la persona. Los insultos, el acoso o revelar datos personales resultarán en una suspensión. Se fomenta el desacuerdo constructivo, pero siempre con respeto y educación.',
    dos: [
      'Cuestionar los argumentos con pruebas y respeto',
      'Aceptar de buena manera las correcciones y argumentos válidos de otros',
      'Usar un lenguaje neutro y preciso en debates técnicos'
    ],
    donts: [
      'Usar lenguaje ofensivo o despectivo contra otros miembros',
      'Intentar revelar la identidad del mundo real de usuarios seudónimos',
      'Atacar a usuarios por cometer errores'
    ],
  },
  {
    n: '04',
    icon: Zap,
    title: 'Mantenerse en el tema del foro',
    body: 'Este foro está dedicado al análisis de la blockchain, finanzas descentralizadas (DeFi), comportamiento de grandes billeteras (ledgers) y la plataforma Humanity Ledger. Las conversaciones fuera de tema o la promoción no autorizada no están permitidas.',
    dos: [
      'Abrir hilos en la categoría correcta (Análisis, Plataforma, Investigación, etc.)',
      'Usar títulos descriptivos que faciliten la lectura de los temas',
      'Enlazar a debates previos relacionados para dar contexto'
    ],
    donts: [
      'Promocionar proyectos propios, tokens o NFTs sin autorización previa',
      'Publicar noticias generales de criptomonedas que ya están en otros sitios',
      'send spam con el mismo contenido en varias categorías'
    ],
  },
  {
    n: '05',
    icon: Flag,
    title: 'Reportar en lugar de responder con agresividad',
    body: 'Si encuentras contenido que infringe las normas, usa la función de reporte. No respondas con agresividad ni intentes avergonzar públicamente al usuario. El equipo de moderación revisará el caso y tomará las medidas oportunas.',
    dos: [
      'Usar la función de reporte para cualquier infracción',
      'Contactar a los moderadores para asuntos urgentes o delicados',
      'Confiar en el proceso de moderación establecido'
    ],
    donts: [
      'Responder a publicaciones de mala fe con más agresividad',
      'Exponer o culpar públicamente a usuarios específicos',
      'Organizar grupos de usuarios para votar en contra de alguien'
    ],
  },
  {
    n: '06',
    icon: Users,
    title: 'Proteger la privacidad de todos',
    body: 'Nunca compartas tus claves privadas, frases semilla o credenciales en el foro. Respeta el anonimato de los demás usuarios y no intentes revelar la identidad de miembros que prefieren usar seudónimos.',
    dos: [
      'Acortar las direcciones de billetera al hacer referencia a ellas',
      'Respetar el seudónimo de los demás miembros',
      'Usar canales cifrados y seguros para coordinaciones delicadas'
    ],
    donts: [
      'Compartir claves privadas, frases semilla o credenciales bajo ningún concepto',
      'Intentar vincular un seudónimo con una persona real',
      'Publicar capturas de pantalla que muestren datos privados de otros usuarios'
    ],
  },
];

export default function ForumGuidelinesPage() {
  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF9] text-slate-900 w-full min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-[12px] font-sans font-bold text-slate-500">
            <Link href="/forum" className="transition-colors hover:text-[#0088cc]">Forum</Link>
            <span>/</span>
            <span className="text-slate-900">Guidelines</span>
          </div>
        </div>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-[28px] md:text-[36px] font-black tracking-tight text-slate-900 leading-none mb-4 uppercase">
            Normas de la Comunidad
          </h1>
          <p className="text-[14px] text-slate-500 font-medium max-w-2xl leading-relaxed">
            El foro de Humanity Ledger es un espacio de alta calidad para el análisis de blockchain, DeFi e inteligencia financiera. Estas normas existen para proteger la calidad del contenido y asegurar una convivencia sana.
          </p>
        </div>

        {/* Quote banner */}
        <div className="mb-12 p-6 bg-white border border-slate-200 rounded-xl flex items-start gap-4">
          <MessageSquare size={18} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[14px] italic text-slate-600 leading-relaxed font-medium">
            "Una comunidad se define por el comportamiento más bajo que está dispuesta a tolerar. Mantenemos el nivel muy alto porque quienes confían en esta información merecen excelencia."
          </p>
        </div>

        {/* Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {RULES.map(rule => (
            <div key={rule.n} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              
              {/* Rule header */}
              <div className="flex items-start gap-4 px-6 pt-6 pb-5">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <span className="text-[12px] font-mono font-black text-slate-300">{rule.n}</span>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-100 bg-black/5">
                    <rule.icon size={16} className="text-slate-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-black tracking-tight text-slate-900 mb-2 uppercase">{rule.title}</h2>
                  <p className="text-[13px] text-slate-500 leading-relaxed">{rule.body}</p>
                </div>
              </div>

              {/* Do / Don't */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100 border-t border-slate-100 mt-auto">
                <div className="bg-white px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={12} className="text-[#00C076]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00C076]">Do</span>
                  </div>
                  <ul className="space-y-3">
                    {rule.dos.map((d, i) => (
                      <li key={i} className="text-[12px] text-slate-600 font-medium leading-snug flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C076]/30 shrink-0 mt-1.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Don't</span>
                  </div>
                  <ul className="space-y-3">
                    {rule.donts.map((d, i) => (
                      <li key={i} className="text-[12px] text-slate-600 font-medium leading-snug flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/30 shrink-0 mt-1.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Enforcement */}
        <div className="mt-12 bg-slate-900 rounded-xl p-8 text-white">
          <h3 className="text-[16px] font-black tracking-tight mb-3 uppercase text-white">Aplicación de Normas y Apelaciones</h3>
          <p className="text-[13px] text-slate-300 leading-relaxed font-medium mb-6 max-w-4xl">
            Las infracciones se tratarán según su gravedad: advertencia inicial para faltas menores, suspensión temporal de 3 a 30 días para reincidencias, y expulsión permanente del foro en casos graves de manipulación de mercado, acoso o exposición de datos privados. Las apelaciones pueden enviarse a <span className="font-bold border-b border-slate-500">moderation@humanidfi.com</span> en un plazo máximo de 14 días. Las decisiones serán resueltas por el equipo en un plazo de 5 días hábiles.
          </p>
          <div className="flex items-center gap-2 pt-5 border-t border-slate-800">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Última actualización: Mayo 2026</span>
          </div>
        </div>

      </div>
    </div>
  );
}
