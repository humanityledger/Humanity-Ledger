
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Smartphone, Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import { Wallet } from 'ethers';
import { encryptWithPassword, generateWalletSalt } from '@/lib/wallet-security';

interface AuthModalProps {
    onAuthenticated: () => void;
}

type Step = 'email' | 'verify' | 'password';

export function AuthModal({ onAuthenticated }: AuthModalProps) {
    const [step, setStep] = useState<Step>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [userId, setUserId] = useState('');
    const [isSignup, setIsSignup] = useState(false);

    // Step 1: Email Entry
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Check if email exists
            const checkResponse = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const checkData = await checkResponse.json();

            // All users get a verification code
            // New users: code  password  access
            // Existing verified users: code  access (passwordless)
            if (checkData.exists && !checkData.requiresVerification) {
                // Existing verified user - passwordless login
                setIsSignup(false);
            } else {
                // New user or unverified user - signup flow
                setIsSignup(true);
            }

            // Send verification code for everyone
            const response = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                setIsLoading(false);
                toast.error(data.error || 'Failed to send code');
                return;
            }

            setUserId(data.userId);
            setStep('verify');
            setIsLoading(false);
            toast.success('Verification code sent to your email');
        } catch (error) {
            setIsLoading(false);
            toast.error('Network error. Please try again.');
        }
    };

    // Step 2: Verify Code (signup only)
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    code,
                    isLogin: !isSignup // If not signup, it's a login
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setIsLoading(false);
                toast.error(data.error || 'Invalid code');
                return;
            }

            // If existing user (passwordless login), authentication is complete
            if (!isSignup) {
                setIsLoading(false);
                toast.success('Welcome back!');
                onAuthenticated();
            } else {
                // New user - proceed to password creation
                setStep('password');
                setIsLoading(false);
                toast.success('Email verified!');
            }
        } catch (error) {
            setIsLoading(false);
            toast.error('Network error. Please try again.');
        }
    };

    // Step 3: Password Entry/Creation
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isSignup) {
                // Validation
                if (password !== confirmPassword) {
                    setIsLoading(false);
                    toast.error('Passwords do not match');
                    return;
                }

                if (!username) {
                    setIsLoading(false);
                    toast.error('Username is required');
                    return;
                }

                // [NEW] Generate and encrypt internal wallet
                const wallet = Wallet.createRandom();
                const mnemonic = wallet.mnemonic?.phrase || '';
                const walletAddress = wallet.address;
                const walletSalt = generateWalletSalt();
                const encryptedMnemonic = await encryptWithPassword(mnemonic, password);

                // Complete signup with wallet data
                const response = await fetch('/api/auth/complete-signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        password, 
                        username, // [NEW] Elite Username
                        name,
                        walletAddress,
                        encryptedMnemonic,
                        walletSalt
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    setIsLoading(false);
                    toast.error(data.error || 'Signup failed');
                    return;
                }

                // No need to store token in localStorage - server sets httpOnly cookies
                setIsLoading(false);
                toast.success('Account created!');
                onAuthenticated();
            } else {
                // Sign in
                const response = await fetch('/api/auth/custom-signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    setIsLoading(false);
                    toast.error(data.error || 'Invalid credentials');
                    return;
                }

                // No need to store token in localStorage - server sets httpOnly cookies
                setIsLoading(false);
                toast.success('Welcome back!');
                onAuthenticated();
            }
        } catch (error) {
            setIsLoading(false);
            toast.error('Network error. Please try again.');
        }
    };

    const handleGoogleSignIn = () => {
        signIn('google', { callbackUrl: '/' });
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative w-full max-w-[450px] bg-white rounded-3xl shadow-2xl overflow-hidden text-neutral-900 border border-neutral-100"
            >
                {/* Header */}
                <div className="pt-10 pb-2 px-10 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4 text-white shadow-blue-200 shadow-lg">
                        <Lock size={24} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                        {step === 'email' && 'Welcome to HumanDefi'}
                        {step === 'verify' && 'Check your email'}
                        {step === 'password' && (isSignup ? 'Create password' : 'Enter password')}
                    </h2>
                    <p className="text-neutral-500 text-sm mt-2">
                        {step === 'email' && 'Enter your email to continue'}
                        {step === 'verify' && `We sent a code to ${email}`}
                        {step === 'password' && (isSignup ? 'Almost done! Set your password' : 'Welcome back')}
                    </p>
                </div>

                <div className="p-10 pt-6">
                    <AnimatePresence mode="wait" initial={false}>
                        {/* Step 1: Email */}
                        {step === 'email' && (
                            <motion.form 
                                key="email"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleEmailSubmit}
                                className="space-y-5"
                            >
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Email</label>
                                    <div className="relative group">
                                        <input 
                                            type="email" 
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all font-medium"
                                            placeholder="name@example.com"
                                            autoFocus
                                        />
                                        <Mail size={18} className="absolute right-4 top-4 text-neutral-400 group-focus-within:text-[#25D366] transition-colors" />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full bg-neutral-900 text-white font-bold py-4 rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-neutral-200"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : "Continue"}
                                </button>

                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200"></div></div>
                                    <div className="relative flex justify-center text-xs uppercase font-bold"><span className="bg-white px-3 text-neutral-400">Or continue with</span></div>
                                </div>

                                <button 
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    className="w-full bg-white border border-neutral-200 text-neutral-700 font-bold py-3.5 rounded-xl hover:bg-neutral-50 transition-colors flex items-center justify-center gap-3"
                                >
                                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                    Google Account
                                </button>
                            </motion.form>
                        )}

                        {/* Step 2: Verify Code */}
                        {step === 'verify' && (
                            <motion.form 
                                key="verify"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleVerifyCode}
                                className="space-y-6"
                            >
                                <div className="bg-blue-50 rounded-2xl p-6 text-center">
                                    <Smartphone className="mx-auto text-blue-600 mb-2" size={32} />
                                    <p className="text-sm text-blue-800 font-medium">
                                        Check your inbox for the <br/>
                                        <span className="font-bold">6-digit code</span>
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Verification Code</label>
                                    <input 
                                        type="text" 
                                        maxLength={6}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all text-neutral-900"
                                        placeholder="000000"
                                        autoFocus
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading || code.length < 6}
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : "Verify"}
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setStep('email')}
                                    className="w-full text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors"
                                >
                                    Back to email
                                </button>
                            </motion.form>
                        )}

                        {/* Step 3: Password & User Setup */}
                        {step === 'password' && (
                            <motion.form 
                                key="password"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handlePasswordSubmit}
                                className="space-y-4"
                            >
                                {isSignup && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Username</label>
                                            <div className="relative group">
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all font-medium"
                                                    placeholder="elite_verifier"
                                                />
                                                <User size={18} className="absolute right-4 top-3.5 text-neutral-400 group-focus-within:text-[#25D366] transition-colors" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Password</label>
                                    <div className="relative group">
                                        <input 
                                            type="password" 
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all font-medium"
                                            placeholder=""
                                            autoFocus={!isSignup}
                                        />
                                        <Lock size={18} className="absolute right-4 top-3.5 text-neutral-400 group-focus-within:text-[#25D366] transition-colors" />
                                    </div>
                                </div>

                                {isSignup && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Confirm Password</label>
                                            <div className="relative group">
                                                <input 
                                                    type="password" 
                                                    required
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all font-medium"
                                                    placeholder=""
                                                />
                                                <Lock size={18} className="absolute right-4 top-3.5 text-neutral-400 group-focus-within:text-[#25D366] transition-colors" />
                                            </div>
                                        </div>
                                        <div className="px-1 py-1">
                                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                                                * Elite standard: Min 8 chars, uppercase, lowercase, number.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full bg-neutral-900 text-white font-bold py-4 rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-neutral-200 mt-2"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : (isSignup ? "Complete Registration" : "Sign In")}
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setStep('email')}
                                    className="w-full text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors"
                                >
                                    Back to email
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}


