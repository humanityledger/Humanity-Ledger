// components/MainVault.tsx
import { useAuth } from '../hooks/useAuth'
import { useChainId, useAccount, useConnect, useSwitchChain } from 'wagmi';

interface MainVaultProps {
    onConnect?: () => void;
}

export const MainVault = ({ onConnect }: MainVaultProps) => {
    const { balance, isLoading, isAuthenticated, isPremium } = useAuth()
    const chainId = useChainId();
    const { isConnected, chain } = useAccount();
    const { connect, connectors } = useConnect();
    const { switchChain } = useSwitchChain();

    // Logic for Network Badge
    const getNetworkState = () => {
        if (!isConnected) return { name: 'DISCONNECTED', color: 'bg-red-500', isError: true };

        // Use chain?.id from useAccount for real-time provider state, fallback to useChainId
        const activeChainId = chain?.id || chainId;

        switch (activeChainId) {
            case 10: return { name: 'OPTIMISM', color: 'bg-[#25D366]', targetChainId: 10 };
            case 8453: return { name: 'BASE', color: 'bg-[#25D366]', targetChainId: 8453 };
            case 11155420: return { name: 'OP SEPOLIA', color: 'bg-[#25D366]', targetChainId: 11155420 };
            case 84532: return { name: 'BASE SEPOLIA', color: 'bg-[#25D366]', targetChainId: 84532 };
            default: return { name: 'WRONG NETWORK', color: 'bg-red-500', isError: true };
        }
    };

    const network = getNetworkState();

    const handleBadgeClick = () => {
        if (network.isError && isConnected) {
            // Default to Optimism if wrong network
            switchChain({ chainId: 10 });
        }
    };

    return (
        <div className="bg-[#0a0a0a] text-white p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Background Glow for Connected State */}
            {isConnected && !network.isError && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#25D366]/10 blur-[100px] -z-0" />
            )}

            {/* Network Indicator (Dynamic & Interactive) */}
            <button
                onClick={handleBadgeClick}
                disabled={!network.isError}
                className={`relative z-10 flex items-center gap-2 mb-6 transition-opacity hover:opacity-80 ${network.isError ? 'cursor-pointer' : 'cursor-default'}`}
            >
                <div className={`h-2.5 w-2.5 rounded-full ${network.color} animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />
                <span className={`text-xs font-bold tracking-widest uppercase ${network.isError ? 'text-red-400' : 'text-neutral-400'}`}>
                    {network.name}
                </span>
                {network.isError && isConnected && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded ml-2 border border-red-500/20">SWITCH</span>
                )}
            </button>

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <p className="text-gray-500 text-sm font-medium flex items-center gap-2">
                        Net Worth Estimate <span className="rotate-180"></span>
                    </p>
                    <h2 className="text-6xl font-bold mt-2 tracking-tighter">
                        ${isLoading ? '...' : (Number(balance) * 0.45).toFixed(2)}
                        <span className="text-lg align-top ml-1 text-gray-400">,00</span>
                    </h2>
                </div>
                <div className="bg-[#25D366]/10 text-[#25D366] px-3 py-1 rounded-full text-xs font-bold h-fit">
                     0%
                </div>
            </div>

            {/* Bottom Section: Status & Connect */}
            {isConnected && (
                <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                    <div className="flex items-center gap-2 text-emerald-400 bg-[#25D366]/10 px-4 py-2 rounded-lg w-fit">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-sm font-bold">WALLET CONNECTED</span>
                    </div>
                </div>
            )}
        </div>
    )
}


