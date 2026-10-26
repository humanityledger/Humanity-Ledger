'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { safeStorage } from '@/lib/security/safe-storage';

interface WorldContextType {
    isVerified: boolean;
    verifyIdentity: (result: any) => Promise<void>;
    nullifierHash: string | null;
    isLoading: boolean;
}

const WorldContext = createContext<WorldContextType>({
    isVerified: false,
    verifyIdentity: async () => { },
    nullifierHash: null,
    isLoading: false,
});

export const useWorld = () => useContext(WorldContext);

export const WorldProvider = ({ children }: { children: ReactNode }) => {
    const { address, isConnected } = useAccount();
    
    // Real verification state - starts as false until user verifies
    const [isVerified, setIsVerified] = useState(false);
    const [nullifierHash, setNullifierHash] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Default true

    // Hydration: Check if already verified before (BY WALLET)
    useEffect(() => {
        const checkVerification = async () => {
            setIsLoading(true);

            if (!isConnected || !address) {
                setIsVerified(false);
                setNullifierHash(null);
                setIsLoading(false);
                return;
            }

            const walletKey = `world-id-proof-${address.toLowerCase()}`;

            // 1. Check LocalStorage specific to this wallet first (Fast Path)
            const savedProof = safeStorage.getItem(walletKey);
            if (savedProof) {
                setIsVerified(true);
                setNullifierHash(savedProof);
                setIsLoading(false);
            }

            // 2. Check Server API (Source of Truth)
            try {
                const res = await fetch(`/api/user/status?address=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    
                    if (data.verified) {
                        setIsVerified(true);
                        setNullifierHash(data.nullifierHash);
                        // Sync specific wallet proof to local storage
                        if (data.nullifierHash) {
                            safeStorage.setItem(walletKey, data.nullifierHash);
                        }
                    } else {
                        // If server says not verified, remove local proof (security enforcement)
                        if (savedProof) {
                            safeStorage.removeItem(walletKey);
                            setIsVerified(false);
                            setNullifierHash(null);
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking verification status from server:", error);
                // Fallback: if api fails but we have local proof, keep it for now? 
                // Decision: For security, we might want to fail safe, but for UX, keep local.
                // We'll stick with what we have if API fails.
            } finally {
                setIsLoading(false);
            }
        };

        checkVerification();
    }, [address, isConnected]);

    const verifyIdentity = async (result: any) => {
        if (!address) {
            console.error("[WorldContext] No wallet connected during verification.");
            return;
        }

        console.log("[WorldContext]  Initiating backend verification...");
        
        try {
            const res = await fetch('/api/verify-identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...result,
                    address: address.toLowerCase()
                }),
            });

            const data = await res.json();

            if (res.ok && data.verified) {
                console.log("[WorldContext]  Backend verification successful.");
                setIsVerified(true);
                setNullifierHash(data.nullifier_hash || result.nullifier_hash);
                safeStorage.setItem(`world-id-proof-${address.toLowerCase()}`, data.nullifier_hash || result.nullifier_hash);
            } else {
                console.error("[WorldContext]  Verification failed:", data.detail || "Unknown error");
                throw new Error(data.detail || "Verification failed");
            }
        } catch (error) {
            console.error("[WorldContext]  Network/Server error during verification:", error);
            throw error; // Re-throw so IDKit handleVerify can catch it
        }
    };

    return (
        <WorldContext.Provider value={{
            isVerified,
            verifyIdentity,
            nullifierHash,
            isLoading
        }}>
            {children}
        </WorldContext.Provider>
    );
};
