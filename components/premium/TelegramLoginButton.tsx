"use client";

import { useEffect, useRef } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
}

export default function TelegramLoginButton({ botName, onAuth }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if script already exists
    const scriptId = 'telegram-login-script';
    
    // Define global callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      console.log('Telegram Auth Success:', user);
      onAuth(user);
    };

    if (containerRef.current) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.id = scriptId;
      
      // Data attributes
      script.setAttribute('data-telegram-login', botName);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    // Cleanup not strictly necessary for script tag itself as it replaces innerHTML
    // but good practice to remove global callback if unmounting
    return () => {
      // (window as any).onTelegramAuth = undefined; // Don't remove in case of re-renders
    };
  }, [botName, onAuth]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-blue-50/50 rounded-xl border border-blue-100">
      <p className="text-sm font-bold text-blue-800 mb-3">
        Click to connect instantly 
      </p>
      <div ref={containerRef} className="min-h-[40px]" />
      <p className="text-xs text-blue-600/70 mt-3 text-center">
        This will authorize the bot to send you alerts
      </p>
    </div>
  );
}


