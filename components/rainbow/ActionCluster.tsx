"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ArrowUpRight, 
    ArrowDownLeft, 
    Repeat, 
    Plus, 
    Shield, 
    Globe, 
    Zap, 
    CreditCard, 
    QrCode,
    Layers
} from "lucide-react";

interface SubItem {
    label: string;
    icon: any;
    desc: string;
    mode: string;
}

interface Action {
    label: string;
    icon: any;
    color: string;
    subitems: SubItem[];
}

const actions: Action[] = [
  { 
    label: "Send", 
    icon: ArrowUpRight, 
    color: "bg-[#25D366]",
    subitems: [
        { label: "Direct", icon: ArrowUpRight, desc: "Standard wallet-to-wallet", mode: "standard" },
        { label: "Bridge", icon: Globe, desc: "Move assets to other chains", mode: "bridge" },
        { label: "Private", icon: Shield, desc: "Shielded ZK-transaction", mode: "private" }
    ]
  },
  { 
    label: "Receive", 
    icon: ArrowDownLeft, 
    color: "bg-green-500",
    subitems: [
        { label: "QR Code", icon: QrCode, desc: "Show your address QR", mode: "qr" },
        { label: "Select Network", icon: Layers, desc: "Receive on L2/Sidechain", mode: "network" },
        { label: "ENS Name", icon: Globe, desc: "Copy your .eth name", mode: "ens" }
    ]
  },
  { 
    label: "Swap", 
    icon: Repeat, 
    color: "bg-purple-500",
    subitems: [
        { label: "Direct", icon: Repeat, desc: "1inch Liquidity Aggregator", mode: "aggregator" },
        { label: "Cross-Chain", icon: Globe, desc: "Atomic swap between chains", mode: "crosschain" },
        { label: "Limit Order", icon: Zap, desc: "Set execution price", mode: "limit" }
    ]
  },
  { 
    label: "Buy", 
    icon: Plus, 
    color: "bg-pink-500",
    subitems: [
        { label: "Credit Card", icon: CreditCard, desc: "Fiat-to-Crypto onramp", mode: "card" },
        { label: "Direct Deposit", icon: ArrowDownLeft, desc: "From Bank / Exchange", mode: "deposit" }
    ]
  },
];

interface ActionClusterProps {
  onAction: (action: string, mode?: string) => void;
}

export function ActionCluster({ onAction }: ActionClusterProps) {
  return (
    <div className="flex justify-center gap-4 py-8 relative">
      {actions.map((action, index) => (
        <div key={action.label} className="relative flex flex-col items-center">
            <motion.button
              onClick={() => onAction(action.label)} // Action modes simplified to direct click to modal
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`w-14 h-14 rounded-full ${action.color} flex items-center justify-center text-white border border-white/5 shadow-2xl relative group overflow-hidden`}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors" />
              <action.icon size={24} strokeWidth={2.5} className="relative z-10" />
            </motion.button>
            <span className="text-[11px] font-bold text-white/50 tracking-wide mt-3 group-hover:text-white transition-colors">
              {action.label}
            </span>
        </div>
      ))}
    </div>
  );
}


