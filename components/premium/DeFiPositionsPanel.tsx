"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Layers, PiggyBank, Coins, ExternalLink } from 'lucide-react';
import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';

interface DeFiPosition {
  protocol: string;
  protocolLogo?: string;
  type: 'Lending' | 'LP' | 'Staking' | 'Other';
  label: string;
  tokens: Array<{
    symbol: string;
    balance: number;
    balanceFormatted: string;
    valueUsd: number;
    logo?: string;
  }>;
  valueUsd: number;
}

interface DeFiPositionsPanelProps {
  positions: DeFiPosition[];
  totalValueUsd: number;
  protocolCount: number;
}

export default function DeFiPositionsPanel({ positions, totalValueUsd, protocolCount }: DeFiPositionsPanelProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/5">
        <Layers size={56} className="mx-auto mb-5 opacity-20 text-emerald-400" />
        <h3 className="text-2xl font-black text-white mb-2">Sin Posiciones DeFi</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          No se detectaron posiciones activas en protocolos DeFi compatibles (Aave, Uniswap, Compound, Curve, Lido).
        </p>
      </div>
    );
  }

  // Group by protocol
  const byProtocol = positions.reduce((acc, pos) => {
    if (!acc[pos.protocol]) {
      acc[pos.protocol] = [];
    }
    acc[pos.protocol].push(pos);
    return acc;
  }, {} as Record<string, DeFiPosition[]>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Lending': return <Coins size={20} className="text-green-400" />;
      case 'LP': return <Layers size={20} className="text-purple-400" />;
      case 'Staking': return <PiggyBank size={20} className="text-yellow-400" />;
      default: return <Coins size={20} className="text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Lending': return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'LP': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'Staking': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      default: return 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-gradient-to-br from-emerald-600/20 to-purple-600/20 border border-[#25D366]/30 rounded-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366]/20 blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">Total DeFi</p>
            <p className="text-4xl font-black text-white">${safeToLocaleString(totalValueUsd)}</p>
            <p className="text-xs text-gray-400 mt-1">Valor Total Bloqueado</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-white/5 border border-white/10 rounded-2xl"
        >
          <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Protocolos</p>
          <p className="text-4xl font-black text-white">{protocolCount}</p>
          <p className="text-xs text-gray-500 mt-1">Activos</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 bg-white/5 border border-white/10 rounded-2xl"
        >
          <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Posiciones</p>
          <p className="text-4xl font-black text-white">{positions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </motion.div>
      </div>

      {/* Posiciones por Protocolo */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-3">
          <Layers size={24} className="text-emerald-400" />
          Posiciones por Protocolo
        </h3>

        {Object.entries(byProtocol).map(([protocol, protocolPositions], protocolIdx) => {
          const protocolTotal = protocolPositions.reduce((sum, p) => sum + p.valueUsd, 0);

          return (
            <motion.div
              key={protocol}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: protocolIdx * 0.1 }}
              className="bg-black/40 border border-white/10 rounded-3xl overflow-hidden"
            >
              {/* Protocol Header */}
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-purple-500/20 border border-white/20 flex items-center justify-center">
                      <Layers size={28} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-white">{protocol}</h4>
                      <p className="text-sm text-gray-500">{protocolPositions.length} posiciones</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-white">${safeToLocaleString(protocolTotal)}</p>
                    <p className="text-xs text-gray-500">Valor Total</p>
                  </div>
                </div>
              </div>

              {/* Positions List */}
              <div className="p-6 space-y-3">
                {protocolPositions.map((position, posIdx) => (
                  <div
                    key={posIdx}
                    className={`p-5 bg-gradient-to-br ${getTypeColor(position.type)} border rounded-2xl`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(position.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white font-bold uppercase tracking-wider">
                              {position.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{position.label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">${safeToLocaleString(position.valueUsd)}</p>
                      </div>
                    </div>

                    {/* Tokens in Position */}
                    <div className="flex flex-wrap gap-2">
                      {position.tokens.map((token, tokenIdx) => (
                        <div
                          key={tokenIdx}
                          className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white font-bold">{token.symbol}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-sm text-gray-400">{token.balanceFormatted}</span>
                          </div>
                          <span className="text-xs text-gray-600">
                            ${safeToLocaleString(token.valueUsd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


