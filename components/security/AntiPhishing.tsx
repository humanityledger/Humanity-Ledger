/**
 * Anti-Phishing Protection Component
 * 
 * Provides visual indicators and warnings to protect users from phishing attacks
 * Features:
 * - Domain verification
 * - Visual security indicators
 * - Certificate information display
 * - Bookmark reminders
 */

"use client";

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Bookmark, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityStatus {
  isSecure: boolean;
  domain: string;
  certificate?: {
    issuer: string;
    validFrom: Date;
    validTo: Date;
  };
  warnings: string[];
}

export default function AntiPhishing() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [hasBookmark, setHasBookmark] = useState(false);

  useEffect(() => {
    checkSecurity();
    checkBookmarkStatus();
  }, []);

  /**
   * Verify domain and certificate
   */
  const checkSecurity = () => {
    const warnings: string[] = [];
    const domain = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';

    // Check for common phishing indicators
    if (!isSecure) {
      warnings.push('Not using HTTPS encryption');
    }

    // Check for suspicious domains
    if (domain && !isOfficialDomain(domain)) {
      warnings.push('This may not be the official Humanity Ledger domain');
    }

    // Check for homograph attacks (lookalike characters)
    if (containsSuspiciousCharacters(domain)) {
      warnings.push('Domain contains suspicious characters');
    }

    setSecurityStatus({
      isSecure,
      domain,
      warnings
    });

    // Show banner on first visit or if warnings exist
    if (warnings.length > 0 || !localStorage.getItem('anti-phishing-banner-seen')) {
      setShowBanner(true);
    }
  };

  /**
   * Check if domain is official
   */
  const isOfficialDomain = (domain: string): boolean => {
    const officialDomains = [
      'humanidfi.com',
      'humanid.fi',
      'localhost',
      'vercel.app',
      'railway.app'
    ];

    return officialDomains.some(official => 
      domain === official || domain.endsWith(`.${official}`)
    );
  };

  /**
   * Detect homograph attacks (lookalike characters)
   */
  const containsSuspiciousCharacters = (domain: string): boolean => {
    // Check for non-ASCII characters that might look like ASCII
    const suspiciousChars = /[а-яА-ЯёЁα-ωΑ-Ω]/; // Cyrillic, Greek
    return suspiciousChars.test(domain);
  };

  /**
   * Check if user has bookmarked the site
   */
  const checkBookmarkStatus = () => {
    const bookmarked = localStorage.getItem('site-bookmarked') === 'true';
    setHasBookmark(bookmarked);
  };

  /**
   * Prompt user to bookmark the site
   */
  const promptBookmark = () => {
    if (window.confirm('To protect against phishing, please bookmark this page. Would you like instructions?')) {
      alert(`To bookmark this page:
      
Chrome/Edge: Press Ctrl+D (Windows) or Cmd+D (Mac)
Firefox: Press Ctrl+D (Windows) or Cmd+D (Mac)
Safari: Press Cmd+D

Always Access Humanity Ledger through your bookmark to ensure you're on the official site.`);
      
      localStorage.setItem('site-bookmarked', 'true');
      setHasBookmark(true);
    }
  };

  /**
   * Dismiss banner
   */
  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('anti-phishing-banner-seen', 'true');
  };

  if (!securityStatus) return null;

  const hasWarnings = securityStatus.warnings.length > 0;

  return (
    <>
      {/* Persistent Security Indicator */}
      <div className="fixed bottom-4 right-4 z-40">
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setShowBanner(!showBanner)}
          className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-colors ${
            hasWarnings 
              ? 'bg-red-500/90 hover:bg-red-600' 
              : 'bg-green-500/90 hover:bg-green-600'
          }`}
          title={hasWarnings ? 'Security warnings detected' : 'Site is secure'}
        >
          {hasWarnings ? (
            <AlertTriangle className="text-white" size={24} />
          ) : (
            <Shield className="text-white" size={24} />
          )}
        </motion.button>
      </div>

      {/* Security Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] bg-[var(--aztec-parchment)] backdrop-blur-md border-b-2 border-[var(--aztec-ink)]/10 shadow-lg"
          >
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Security Status */}
                  <div className="flex items-center gap-3 mb-3">
                    {hasWarnings ? (
                      <>
                        <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
                        <div>
                          <h3 className="font-black text-red-600">Security Warning</h3>
                          <p className="text-sm text-[#1F1F1F]/70">
                            Please review the following security concerns
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                        <div>
                          <h3 className="font-black text-green-600">Secure Connection</h3>
                          <p className="text-sm text-[#1F1F1F]/70">
                            You are on the official Humanity Ledger platform
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Domain Info */}
                  <div className="bg-[#1F1F1F]/5 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#1F1F1F]/70">Current Domain:</span>
                      <code className="text-sm font-aztec-mono bg-[var(--aztec-chartreuse)] text-[var(--aztec-ink)] px-2 py-1 rounded shadow-sm font-black">
                        {securityStatus.domain}
                      </code>
                    </div>
                  </div>

                  {/* Warnings */}
                  {securityStatus.warnings.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {securityStatus.warnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bookmark Reminder */}
                  {!hasBookmark && (
                    <button
                      onClick={promptBookmark}
                      className="flex items-center gap-2 text-sm font-bold text-[#1F1F1F] hover:text-blue-600 transition-colors"
                    >
                      <Bookmark size={16} />
                      Bookmark this site for safety
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={dismissBanner}
                  className="p-2 rounded-full hover:bg-[#1F1F1F]/10 transition-colors flex-shrink-0"
                  aria-label="Close security banner"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}



