"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap, Shield, Network, CheckCircle2, Radar } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * [LEGENDARY] Ledger Monitoring Quality Section
 * Explains why Humanity Ledger has the world's best real-time ledger analytics
 */
export function SwapQualitySection() {
  const { t } = useLanguage();
  const router = useRouter();
  const { isConnected: isSignedIn } = useAccount();

  const handleProbarAhora = () => {
    if (isSignedIn) {
      router.push('/ledger');
    } else {
      router.push('/?login=true');
    }
  };
  
  const features = [
    {
      icon: Network,
      title: t.landing.swap.features.lowLatency.title,
      description: t.landing.swap.features.lowLatency.desc
    },
    {
      icon: TrendingUp,
      title: t.landing.swap.features.volume.title,
      description: t.landing.swap.features.volume.desc
    },
    {
      icon: Zap,
      title: t.landing.swap.features.alerts.title,
      description: t.landing.swap.features.alerts.desc
    },
    {
      icon: Shield,
      title: t.landing.swap.features.security.title,
      description: t.landing.swap.features.security.desc
    }
  ];

  const stats = [
    { value: "Satoshi", label: t.landing.swap.stats.detection },
    { value: "5s", label: t.landing.swap.stats.refresh },
    { value: "100%", label: t.landing.swap.stats.data },
    { value: "<1s", label: t.landing.swap.stats.latency }
  ];

  return (
    <section className="relative w-full py-32 px-6 overflow-hidden bg-gradient-to-b from-black via-purple-950/10 to-black">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-[2560px] mx-auto text-left">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Ledger Visual Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative group"
          >
            <div className="relative w-full aspect-square max-w-[500px] mx-auto rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-black/40">
              <Image
                src="/models/update/Aztec Image_03.jpg"
                alt="Humanity Ledger Ledger Monitor"
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
                style={{ 
                  mixBlendMode: 'screen',
                  filter: 'brightness(1.1) contrast(1.1) saturate(1.2)'
                }}
                unoptimized
              />
              {/* Blending Gradient to melt into background */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none" />
            </div>

            {/* Ambient Glow behind image */}
            <div className="absolute -inset-4 bg-purple-500/20 blur-[60px] rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-8"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-sm font-bold text-white/80 uppercase tracking-wider">
                {t.landing.swap.badge}
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-5xl md:text-6xl font-black text-white leading-tight">
              {t.landing.swap.title}
              <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                {t.landing.swap.realtime}
              </span>
            </h2>

            {/* Description */}
            <p className="text-xl text-white/60 leading-relaxed">
              {t.landing.swap.description}
            </p>

            {/* Feature Grid */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group"
                >
                  <feature.icon size={24} className="text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-white font-bold mb-1">{feature.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 pt-6 border-t border-white/10">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProbarAhora}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold px-8 py-4 rounded-2xl shadow-2xl hover:shadow-purple-500/50 transition-all flex items-center gap-3 justify-center"
            >
              <Radar size={18} className="text-white/80" />
              {isSignedIn ? t.landing.swap.ctaPrimaryActive : t.landing.swap.ctaPrimary}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}



