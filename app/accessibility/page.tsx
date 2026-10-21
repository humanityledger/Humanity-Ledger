"use client";

import React from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, ShieldCheck } from 'lucide-react';
import { HLLogo } from '@/components/shared/HLLogo';

export default function AccessibilityDeclaration() {
  return (
    <div className="min-h-screen bg-white text-[#1C1C1E] font-sans pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-10">
          <Link href="/" className="inline-block mb-6">
            <HLLogo size={32} />
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-4">
            <ShieldCheck size={14} />
            European Accessibility Act (Directive 2019/882) Compliance
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Declaración de Accesibilidad
          </h1>
          <p className="text-black/60 text-base leading-relaxed">
            Compromiso de Humanity Ledger con la accesibilidad digital universal y el cumplimiento de las Pautas WCAG 2.1 Nivel AA.
          </p>
        </div>

        <div className="space-y-8 text-black/80 text-sm leading-relaxed">
          <section className="p-6 rounded-2xl bg-black/[0.02] border border-black/[0.06]">
            <h2 className="text-lg font-bold text-black mb-3">1. Estado de Conformidad</h2>
            <p>
              Humanity Ledger se compromete a garantizar la accesibilidad digital para personas con discapacidades, aplicando continuamente mejoras en los estándares técnicos WCAG 2.1 (Nivel AA) y las directivas de accesibilidad de la Unión Europea.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">2. Medidas de Accesibilidad Implementadas</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Navegación por teclado completa:</strong> Foco visible (`focus-visible`) e interactividad secuencial en todos los controles del chat y navegación.</li>
              <li><strong>Compatibilidad con lectores de pantalla:</strong> Atributos ARIA y etiquetas descriptivas en botones de iconos e inputs.</li>
              <li><strong>Respeto a preferencias del sistema:</strong> Soporte para `prefers-reduced-motion` para usuarios con sensibilidad vestibular.</li>
              <li><strong>Contraste cromático:</strong> Jerarquía tipográfica ajustada para legibilidad con ratios de contraste superiores a 4.5:1.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">3. Contacto y Soporte</h2>
            <p>
              Si encuentra alguna barrera de accesibilidad o desea reportar una incidencia técnica, por favor comuníquese a través de <a href="mailto:accessibility@humanityledger.com" className="text-emerald-700 underline font-medium">accessibility@humanityledger.com</a>.
            </p>
          </section>

          <div className="pt-6 border-t border-black/10 text-xs text-black/40">
            Última revisión: Octubre 2026.
          </div>
        </div>
      </div>
    </div>
  );
}
