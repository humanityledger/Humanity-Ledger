"use client";
import React, { useMemo } from 'react';
import { LedgerProShell } from '@/components/terminal/LedgerProShell';
import { DashboardErrorBoundary } from '@/components/terminal/DashboardErrorBoundary';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import dynamic from 'next/dynamic';
import { useQuantumSessionVisibility } from '@/hooks/useQuantumSessionVisibility';
import { useAztecStateSync } from '@/hooks/useAztecStateSync';
import { GoldTicketPanel } from '@/components/terminal/GoldTicketPanel';
import "@/app/terminal/terminal.css";
import { motion, AnimatePresence } from 'framer-motion';
// @ts-nocheck
// TerminalDashboard v4 — dashboard tab replaces billing


// --- Architectural Hooks ---

// --- Static Imports ---


// --- Dynamic Module Registry ---
const LoadingPanel = () => (
  <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-transparent">
    <div className="w-6 h-6 border-2 border-[#050505]  border-t-transparent rounded-full animate-spin" />
  </div>
);

const Registry = {
  LedgerSupport: dynamic(() => import('@/components/terminal/LedgerSupport').then(m => ({ default: m.LedgerSupport })), { ssr: false, loading: LoadingPanel }),
  InstitutionalLedger: dynamic(() => import('@/components/terminal/InstitutionalLedger'), { ssr: false, loading: LoadingPanel }),
  MassTransferIntel: dynamic(() => import('@/components/terminal/MassTransferIntel').then(m => ({ default: m.MassTransferIntel })), { ssr: false, loading: LoadingPanel }),
  SessionLogsPanel: dynamic(() => import('@/components/terminal/SessionLogsPanel').then(m => ({ default: m.SessionLogsPanel })), { ssr: false, loading: LoadingPanel }),
  NetworkMapPanel: dynamic(() => import('@/components/terminal/NetworkMapPanel').then(m => ({ default: m.NetworkMapPanel })), { ssr: false, loading: LoadingPanel }),


  HumanityLedger: dynamic(() => import('@/components/terminal/HumanityLedger'), { ssr: false, loading: LoadingPanel }),
  PortfolioDashboard: dynamic(() => import('@/components/terminal/PortfolioDashboard'), { ssr: false, loading: LoadingPanel }),
  InstitutionalMarkets: dynamic(() => import('@/components/terminal/InstitutionalMarkets').then(m => ({ default: m.InstitutionalMarkets })), { ssr: false, loading: LoadingPanel }),
  LedgerChat: dynamic(() => import('@/components/terminal/LedgerChatV2').then(m => ({ default: m.LedgerChat })), { ssr: false, loading: LoadingPanel }),
  ProvenanceStudioContent: dynamic(() => import('@/components/provenance/ProvenanceStudioContent').then(m => ({ default: m.ProvenanceStudioContent })), { ssr: false, loading: LoadingPanel }),
  LedgerTrackerDashboard: dynamic(() => import('@/components/network/ledger/LedgerTrackerDashboard').then(m => ({ default: m.LedgerTrackerDashboard })), { ssr: false, loading: LoadingPanel }),
  SubscriptionDashboard: dynamic(() => import('@/components/terminal/SubscriptionDashboard').then(m => ({ default: m.SubscriptionDashboard })), { ssr: false, loading: LoadingPanel }),
  NetworkDashboard: dynamic(() => import('@/components/network/NetworkDashboard').then(m => ({ default: m.NetworkDashboard })), { ssr: false, loading: LoadingPanel }),
  GovernanceDashboard: dynamic(() => import('@/components/terminal/GovernanceProposals').then(m => ({ default: m.GovernanceProposals })), { ssr: false, loading: LoadingPanel })
} as const;



// --- Route Renderer Strategy ---
interface RouteRendererProps {
    route: string;
    reconciliationKey: number;
    mutateRoute: (id: string) => void;
}

const PANEL_STYLE = "flex-1 w-full h-full min-h-0 flex flex-col";

const RouteRenderer = React.memo(({ route, reconciliationKey, mutateRoute }: RouteRendererProps) => {
    const ComponentMap: Record<string, JSX.Element> = {
        'gold': <GoldTicketPanel />,
        'zk-identity': <GoldTicketPanel />,
        'chat': <Registry.LedgerChat />,
        'portfolio': <Registry.PortfolioDashboard />,
        'humanity-ledger': <Registry.HumanityLedger />,
        'markets': <Registry.InstitutionalMarkets />,
        'dashboard': <Registry.InstitutionalMarkets />,  // legacy alias
        'inst-ledger': <Registry.InstitutionalLedger />,
        'privacy': <Registry.SessionLogsPanel />,
        'logs': <Registry.SessionLogsPanel />,
        'map': <Registry.NetworkMapPanel />,
        'studio': <Registry.ProvenanceStudioContent variant="desktop" />,
        'token': <Registry.SubscriptionDashboard />,
        'community': <Registry.LedgerSupport />,
        'status': <Registry.NetworkDashboard />,
        'governance': <div className="p-4 sm:p-8 overflow-y-auto w-full"><Registry.GovernanceDashboard /></div>,
    };

    const targetComponent = ComponentMap[route] || <GoldTicketPanel />;
    const strictKey = `${route}-${reconciliationKey}`;

    return (
        <div className={PANEL_STYLE}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={route}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full h-full flex flex-col"
                >
                    <DashboardErrorBoundary key={strictKey}>
                        {targetComponent}
                    </DashboardErrorBoundary>
                </motion.div>
            </AnimatePresence>
        </div>
    );
});
RouteRenderer.displayName = 'RouteRenderer';

// --- Main Architecture ---
export default function TerminalDashboard() {
    const { isChecking } = useSystemAccount();
    
    const [reconciliationKey, forceReconciliation] = useQuantumSessionVisibility();
    const { activeRoute, mutateRoute } = useAztecStateSync(forceReconciliation);

    // ZK Guard Clause
    if (isChecking) {
        return (
            <div className="min-h-screen bg-[#FFFFFF]  flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#050505]  border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <LedgerProShell
            activeTab={activeRoute}
            onTabChange={mutateRoute}
            isExternalEmbed={false}
            isZkVerified={true}
        >
            <div className="flex flex-col w-full h-full min-h-0">
                <RouteRenderer route={activeRoute} reconciliationKey={reconciliationKey} mutateRoute={mutateRoute} />
            </div>
        </LedgerProShell>
    );
}

