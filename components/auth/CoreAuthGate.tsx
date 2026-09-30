"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { Key, EyeOff, Check, ArrowRight, Lock, AlertTriangle, ChevronLeft, Copy, Wallet, Globe } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { RemoteLottie } from '@/components/ui/RemoteLottie';
import { useSystemConnect } from '@/hooks/useSystemConnect';
import { encryptWithPassword, tryDecryptAny } from '@/lib/wallet-security';

// [PERSISTENCE BRIDGE] Sanitize password uniformly across mobile/desktop
// Mobile keyboards silently inject trailing whitespace. Trim ALWAYS.
const sanitizePassword = (p: string) => p.trim();

export interface SystemAccount {
  id: string;
  name: string;
  address: string;
  encryptedBlob: string;
  createdAt: number;
}

type LangKey = 'en' | 'es' | 'zh' | 'ru';

const LANGS: Record<LangKey, Record<string, any>> = {
  en: {
    flag: '', code: 'EN',
    home_title: 'Portfolio', home_sub: 'Connect your wallet or create a secure local wallet to track your holdings.',
    create_vault: 'Create Wallet', create_vault_sub: 'Generate a 12-word recovery phrase',
    unlock_vault: 'Unlock Wallet', unlock_vault_sub: 'Enter your password to unlock',
    mint: 'Login Existing Account', mint_sub: 'Access with your password',
    password_title: 'Wallet Setup', password_sub: 'This password encrypts your recovery phrase on this device only. We never see it.',
    pw_placeholder: 'New Password (8+ characters)', pw_confirm: 'Confirm Password',
    terms: 'I understand that Humanity Ledger cannot recover this password. If I lose it, I need my 12-word phrase to regain access.',
    create_btn: 'Create Wallet',
    secure_title: 'Protect Your Wallet', secure_sub: 'Before revealing your recovery phrase, read these rules carefully.',
    rules_title: 'Security Rules',
    rule1: 'Never share your phrase with anyone  not even Humanity Ledger support.',
    rule2: 'Never save it digitally: no screenshots, notes apps, cloud storage, or email.',
    rule3: 'Write it on paper and keep it in a safe, private place.',
    rule4: 'Anyone with this phrase has full access to your funds  forever.',
    rule5: 'If you lose this phrase and forget your password, your assets cannot be recovered.',
    what_is: 'What is a recovery phrase?',
    what_is_body: 'It is a sequence of 12 words that acts as the master key to your wallet. It is generated locally on your device and is never sent to our servers.',
    reveal_btn: 'Show Recovery Phrase',
    reveal_title: 'Recovery Phrase', reveal_sub: 'Write down these 12 words in the exact order shown. Keep them safe.',
    tap_reveal: 'Tap to Reveal', no_one: 'Make sure no one is watching your screen.',
    show_words: 'Show Words', copy: 'Copy to clipboard', proceed: 'Continue',
    verify_title: 'Confirm Your Phrase', verify_sub: 'Enter the requested words to confirm you have saved your phrase correctly.',
    word: 'Word', verify_btn: 'Verify & Save Wallet',
    encrypting: 'Saving Wallet', encrypting_sub: 'Encrypting your keys locally. This takes a few seconds.',
    decrypting: 'Unlocking', decrypting_sub: 'Restoring your wallet from the encrypted file.',
    unlock_title: 'Unlock Wallet', unlock_sub: 'Enter your password to access your wallet.',
    pw_enter: 'Enter Password', decrypt_btn: 'Unlock', forgot: 'Forgot password? Reset wallet',
    danger_title: 'Danger Zone',
    danger_body: 'This permanently deletes your wallet from this device. Without your 12-word phrase, your funds will be lost forever.',
    cancel: 'Cancel', purge: 'Delete Wallet',
  },
  es: {
    flag: '', code: 'ES',
    home_title: 'Portafolio', home_sub: 'Connect tu wallet o crea una wallet local segura para rastrear tus activos.',
    create_vault: 'Crear Wallet', create_vault_sub: 'Genera una frase de recuperación de 12 palabras',
    unlock_vault: 'Desbloquear Wallet', unlock_vault_sub: 'Introduce tu contraseña',
    mint: 'Login Cuenta Existente', mint_sub: 'Accede con tu contraseña',
    password_title: 'Configurar Wallet', password_sub: 'Esta contraseña cifra tu frase de recuperación en este dispositivo. Nunca la vemos.',
    pw_placeholder: 'Nueva contraseña (mín. 8 caracteres)', pw_confirm: 'Confirmar contraseña',
    terms: 'Entiendo que Humanity Ledger no puede recuperar esta contraseña. Si la pierdo, necesito mis 12 palabras.',
    create_btn: 'Crear Wallet',
    secure_title: 'Protege tu Wallet', secure_sub: 'Antes de ver tu frase de recuperación, lee estas reglas.',
    rules_title: 'Reglas de Seguridad',
    rule1: 'Nunca compartas tu frase con nadie  ni con el soporte de Humanity Ledger.',
    rule2: 'Nunca la guardes digitalmente: sin capturas, notas, correo ni nube.',
    rule3: 'Escríbela en papel y guárdala en un lugar seguro y privado.',
    rule4: 'Quien tenga esta frase tendrá acceso total a tus fondos  para siempre.',
    rule5: 'Si pierdes la frase y olvidas tu contraseña, tus activos no podrán recuperarse.',
    what_is: '¿Qué es una frase de recuperación?',
    what_is_body: 'Es una secuencia de 12 palabras que actúa como la llave maestra de tu wallet. Se genera localmente en tu dispositivo y nunca se envía a nuestros servidores.',
    reveal_btn: 'Mostrar Frase de Recuperación',
    reveal_title: 'Frase de Recuperación', reveal_sub: 'Anota estas 12 palabras en el orden exacto. Guárdalas bien.',
    tap_reveal: 'Toca para Revelar', no_one: 'Asegúrate de que nadie mire tu pantalla.',
    show_words: 'Mostrar Palabras', copy: 'Copiar al portapapeles', proceed: 'Continuar',
    verify_title: 'Confirma tu Frase', verify_sub: 'Introduce las palabras solicitadas para confirmar que has guardado tu frase.',
    word: 'Palabra', verify_btn: 'Verificar y Guardar Wallet',
    encrypting: 'Guardando Wallet', encrypting_sub: 'Cifrando tus claves localmente.',
    decrypting: 'Desbloqueando', decrypting_sub: 'Restaurando tu wallet desde el archivo cifrado.',
    unlock_title: 'Desbloquear Wallet', unlock_sub: 'Introduce tu contraseña para acceder a tu wallet.',
    pw_enter: 'Contraseña', decrypt_btn: 'Desbloquear', forgot: '¿Olvidaste la contraseña? Restablecer wallet',
    danger_title: 'Zona de Peligro',
    danger_body: 'Esto elimina permanentemente tu wallet de este dispositivo. Sin tus 12 palabras, tus fondos se perderán para siempre.',
    cancel: 'Cancelar', purge: 'Eliminar Wallet',
  },
  zh: {
    flag: '', code: '中文',
    home_title: '投资组合', home_sub: '连接你的钱包或创建本地安全钱包来追踪资产。',
    create_vault: '创建钱包', create_vault_sub: '生成一个12个单词的恢复短语',
    unlock_vault: '解锁钱包', unlock_vault_sub: '输入密码解锁',
    mint: '登录现有帐户', mint_sub: '使用密码访问',
    password_title: '钱包设置', password_sub: '此密码仅在本设备上加密你的恢复短语，我们永远不会看到它。',
    pw_placeholder: '新密码（至少8个字符）', pw_confirm: '确认密码',
    terms: '我理解Humanity Ledger无法恢复此密码。如果我忘记密码，需要12个单词恢复访问权限。',
    create_btn: '创建钱包',
    secure_title: '保护你的钱包', secure_sub: '在查看恢复短语之前，请仔细阅读这些规则。',
    rules_title: '安全规则',
    rule1: '永远不要与任何人分享你的短语包括Humanity Ledger客服。',
    rule2: '永远不要以数字方式保存：不要截图、备忘录、云存储或电子邮件。',
    rule3: '将其写在纸上，并存放在安全私密的地方。',
    rule4: '拥有此短语的任何人都可以永久完全访问你的资金。',
    rule5: '如果你丢失了短语并忘记了密码，你的资产将无法恢复。',
    what_is: '什么是恢复短语？',
    what_is_body: '它是12个单词的序列，充当你钱包的主密钥。它在你的设备本地生成，永远不会发送到我们的服务器。',
    reveal_btn: '显示恢复短语',
    reveal_title: '恢复短语', reveal_sub: '按显示的确切顺序写下这12个单词。',
    tap_reveal: '点击显示', no_one: '确保没有人在看你的屏幕。',
    show_words: '显示单词', copy: '复制到剪贴板', proceed: '继续',
    verify_title: '确认你的短语', verify_sub: '输入请求的单词以确认你已正确保存短语。',
    word: '单词', verify_btn: '验证并保存钱包',
    encrypting: '保存钱包', encrypting_sub: '正在本地加密密钥。',
    decrypting: '解锁中', decrypting_sub: '从加密文件恢复钱包。',
    unlock_title: '解锁钱包', unlock_sub: '输入密码访问你的钱包。',
    pw_enter: '密码', decrypt_btn: '解锁', forgot: '忘记密码？重置钱包',
    danger_title: '危险区域',
    danger_body: '这将永久删除此设备上的钱包。没有12个单词，你的资金将永远丢失。',
    cancel: '取消', purge: '删除钱包',
  },
  ru: {
    flag: '', code: 'RU',
    home_title: 'Портфель', home_sub: 'Подключите кошелёк или создайте локальный безопасный кошелёк для отслеживания активов.',
    create_vault: 'Создать кошелёк', create_vault_sub: 'Сгенерировать 12-словную фразу восстановления',
    unlock_vault: 'Разблокировать', unlock_vault_sub: 'Введите пароль для разблокировки',
    mint: 'Войти в аккаунт', mint_sub: 'Вход по паролю',
    password_title: 'Настройка кошелька', password_sub: 'Этот пароль шифрует вашу фразу только на этом устройстве. Мы его никогда не видим.',
    pw_placeholder: 'Новый пароль (мин. 8 символов)', pw_confirm: 'Подтвердите пароль',
    terms: 'Я понимаю, что Humanity Ledger не может восстановить этот пароль. Если я его потеряю, мне понадобится фраза из 12 слов.',
    create_btn: 'Создать кошелёк',
    secure_title: 'Защитите кошелёк', secure_sub: 'Перед тем как увидеть фразу восстановления, прочитайте правила.',
    rules_title: 'Правила безопасности',
    rule1: 'Никогда не делитесь фразой ни с кем  даже с поддержкой Humanity Ledger.',
    rule2: 'Никогда не сохраняйте цифровым способом: без скриншотов, заметок, облака или email.',
    rule3: 'Запишите на бумаге и храните в надёжном частном месте.',
    rule4: 'Любой, кто владеет этой фразой, имеет полный доступ к вашим средствам  навсегда.',
    rule5: 'Если вы потеряете фразу и забудете пароль, активы восстановить невозможно.',
    what_is: 'Что такое фраза восстановления?',
    what_is_body: 'Это последовательность из 12 слов, которая является мастер-ключом к вашему кошельку. Она генерируется локально и никогда не отправляется на наши серверы.',
    reveal_btn: 'Показать фразу восстановления',
    reveal_title: 'Фраза восстановления', reveal_sub: 'Запишите эти 12 слов в точном порядке. Храните их в безопасности.',
    tap_reveal: 'Нажмите, чтобы открыть', no_one: 'Убедитесь, что никто не смотрит на экран.',
    show_words: 'Показать слова', copy: 'Копировать', proceed: 'Продолжить',
    verify_title: 'Подтвердите фразу', verify_sub: 'Введите запрошенные слова, чтобы подтвердить сохранение.',
    word: 'Слово', verify_btn: 'Проверить и сохранить кошелёк',
    encrypting: 'Сохранение кошелька', encrypting_sub: 'Шифрование ключей на вашем устройстве.',
    decrypting: 'Разблокировка', decrypting_sub: 'Восстановление кошелька из зашифрованного файла.',
    unlock_title: 'Разблокировать кошелёк', unlock_sub: 'Введите пароль для доступа к кошельку.',
    pw_enter: 'Пароль', decrypt_btn: 'Разблокировать', forgot: 'Забыли пароль? Сбросить кошелёк',
    danger_title: 'Опасная зона',
    danger_body: 'Это навсегда удалит кошелёк с этого устройства. Без 12 слов средства будут утеряны.',
    cancel: 'Отмена', purge: 'Удалить кошелёк',
  },
};

function LangSelector({ lang, setLang }: { lang: LangKey; setLang: (l: LangKey) => void }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      <Globe size={13} className="text-black/30" />
      {(['en','es','zh','ru'] as LangKey[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
            lang === l
              ? 'bg-white text-white border-[#050505]'
              : 'bg-transparent text-black/40 border-black/10 hover:border-black/30 hover:text-black'
          }`}
        >
          {LANGS[l].flag} {LANGS[l].code}
        </button>
      ))}
    </div>
  );
}

//  SecureStepPanel 
// CRITICAL: This MUST be a separate component so that useState is called at
// the top level of a React function, not inside a switch-case (Rules of Hooks).
function SecureStepPanel({ t, onBack, onProceed }: { t: any; onBack: () => void; onProceed: () => void }) {
  const [openAccordion, setOpenAccordion] = React.useState(false);
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors mb-2"><ChevronLeft size={20}/></button>
      <div className="space-y-3">
        <h2 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase">{t.secure_title}</h2>
        <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed">{t.secure_sub}</p>
      </div>
      <div className="bg-[#FFFFFF] border border-black/5 rounded-[26px] p-7 space-y-5">
        <span className="font-black uppercase tracking-widest text-[14px] text-[#050505] block">{t.rules_title}</span>
        <ul className="space-y-4">
          {[t.rule1, t.rule2, t.rule3, t.rule4, t.rule5].map((rule: string, i: number) => (
            <li key={i} className="flex items-start gap-3 text-[14px] text-[#050505]/70 font-medium">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-rose-500' : i === 3 || i === 4 ? 'bg-amber-500' : 'bg-white/30'}`} />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border border-black/5 rounded-[20px] overflow-hidden">
        <button
          onClick={() => setOpenAccordion(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.02] transition-colors"
        >
          <span className="text-[14px] font-bold text-[#050505]">{t.what_is}</span>
          <span className={`text-[18px] text-black/30 transition-transform duration-200 ${openAccordion ? 'rotate-45' : ''}`}>+</span>
        </button>
        {openAccordion && (
          <div className="px-5 pb-5 text-[13px] text-[#050505]/60 font-medium leading-relaxed border-t border-black/5">
            <p className="pt-4">{t.what_is_body}</p>
          </div>
        )}
      </div>
      <button
        onClick={onProceed}
        className="w-full py-5 rounded-[20px] bg-white text-white font-black tracking-widest text-[14px] uppercase transition-all shadow-lg active:scale-[0.98]"
      >
        {t.reveal_btn}
      </button>
    </div>
  );
}

export function CoreAuthGate({ onComplete, startAt }: { onComplete: () => void; startAt?: 'home' | 'login' | 'mnemonic' | 'password' | 'generating_wallet' | 'transaction_complete' | 'secure' | 'reveal' | 'verify' | 'encrypting' }) {
  const [lang, setLang] = useState<LangKey>('en');
  const t = LANGS[lang];

  //  Determine initial step 
  // If startAt is provided externally (e.g. from sign-up page), use it directly.
  // Otherwise: if the user already has a system_keystore, go straight to 'login';
  // otherwise show 'home' (create/login choice).
  const getInitialStep = (): 'home' | 'login' => {
    if (typeof window === 'undefined') return 'home';
    try {
      const accs = localStorage.getItem('system_accounts');
      if (accs && JSON.parse(accs).length > 0) return 'login';
      const ks = localStorage.getItem('system_keystore');
      const vault = localStorage.getItem('system_vault_v1');
      return (ks || vault) ? 'login' : 'home';
    } catch {
      return 'home';
    }
  };

  const [step, setStep] = useState<'home' | 'login' | 'mnemonic' | 'password' | 'generating_wallet' | 'transaction_complete' | 'secure' | 'reveal' | 'verify' | 'encrypting'>(startAt ?? 'home');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    if (!startAt) {
      setStep(getInitialStep());
    }
  }, [startAt]);
  const [hasKeystore, setHasKeystore] = useState(false);
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Verification state
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<string[]>(['', '', '']);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [clickedMint, setClickedMint] = useState(false);
  // Mnemonic recovery state
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [mnemonicError, setMnemonicError] = useState('');
  // Timer refs for cleanup on unmount (prevents setState-on-unmounted warning)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // [TOAST GUARD] Prevents duplicate unlock toast on silent background reconnects.
  // Resets to false when the user deliberately goes through the login flow.
  const toastFiredRef = useRef<boolean>(false);
  const { isConnected } = useAccount();
  const importWallet = useWalletStore(s => s.importWallet);
  const storeSetupPassword = useWalletStore(s => s.setupPassword);
  const cloudSync = useWalletStore(s => s.cloudSync);
  const { activateSystemVault } = useSystemConnect();

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(persistent => {
        if (persistent) console.log("[Storage] Storage will not be cleared except by explicit user action.");
        else console.log("[Storage] Storage may be cleared by the UA under storage pressure.");
      });
    }
  }, []);

  useEffect(() => {
    if (clickedMint && isConnected) {
      onComplete();
    }
  }, [clickedMint, isConnected, onComplete]);

  useEffect(() => {
    try {
      let currentAccounts: SystemAccount[] = [];
      const stored = localStorage.getItem('system_accounts');
      if (stored) {
        currentAccounts = JSON.parse(stored);
      }
      
      const ks = localStorage.getItem('system_keystore');
      const vault = localStorage.getItem('system_vault_v1');
      
      // Migrate legacy single-account to new array format
      if ((ks || vault) && currentAccounts.length === 0) {
        const legacyAccount: SystemAccount = {
          id: 'legacy-1',
          name: 'Main Wallet',
          address: '', // Unknown until decrypted
          encryptedBlob: (ks || vault) as string,
          createdAt: Date.now()
        };
        currentAccounts.push(legacyAccount);
        localStorage.setItem('system_accounts', JSON.stringify(currentAccounts));
      }

      setAccounts(currentAccounts);
      const exists = currentAccounts.length > 0 || !!(ks || vault);
      setHasKeystore(exists);
      
      if (currentAccounts.length > 0) {
        setSelectedAccountId(currentAccounts[0].id);
      }

      if (exists) {
        setStep('login');
      }
    } catch {
      // localStorage blocked (iOS incognito)
    }
  }, []);

  const handleCreatePassword = () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!termsAccepted) {
      toast.error('You must accept the terms');
      return;
    }
    
    setStep('generating_wallet');
    setLoadingProgress(0);

    const duration = 7000;
    const interval = 50;
    const stepsCount = duration / interval;
    let currentStep = 0;

    let newWallet;
    try {
      newWallet = ethers.Wallet.createRandom();
      setWallet(newWallet);
    } catch (err: any) {
      toast.error('Failed to generate secure keys', { description: err.message });
      setStep('password');
      return;
    }
    
    const indices: number[] = [];
    while(indices.length < 3) {
      const r = Math.floor(Math.random() * 12);
      if(!indices.includes(r)) indices.push(r);
    }
    setVerifyIndices(indices.sort((a,b) => a - b));

    const timer = setInterval(() => {
      currentStep++;
      setLoadingProgress((currentStep / stepsCount) * 100);
      if (currentStep >= stepsCount) {
        clearInterval(timer);
        progressTimerRef.current = null;
        setStep('transaction_complete');
        const t = setTimeout(() => {
          transitionTimerRef.current = null;
          setStep('reveal');
        }, 2500);
        transitionTimerRef.current = t;
      }
    }, interval);
    progressTimerRef.current = timer;
  };

  const handleVerify = async () => {
    if (!wallet || !wallet.mnemonic) return;
    const words = wallet.mnemonic.phrase.split(' ');
    
    for (let i = 0; i < 3; i++) {
      if (verifyInputs[i].trim().toLowerCase() !== words[verifyIndices[i]].toLowerCase()) {
        toast.error(`Word #${verifyIndices[i] + 1} is incorrect.`);
        return;
      }
    }

    setStep('encrypting');
    const startTime = Date.now();

    // Yield to React so the loading UI renders before CPU work begins
    await new Promise(r => setTimeout(r, 60));

    try {
      //  Cryptographic UPGRADE: Use fast AES-256-GCM (PBKDF2-SHA256 × 600k)
      //    instead of the legacy ethers scrypt which crashes on mobile.
      //    We store the mnemonic phrase so it can be restored from any device.
      // [PERSISTENCE FIX] Always sanitize to prevent mobile-keyboard trailing-space bug
      const cleanPassword = sanitizePassword(password);
      const encryptedBlob = await encryptWithPassword(wallet.mnemonic.phrase, cleanPassword);
      
      const newAccount: SystemAccount = {
        id: Date.now().toString(),
        name: `Wallet ${accounts.length + 1}`,
        address: wallet.address,
        encryptedBlob,
        createdAt: Date.now()
      };
      const updatedAccounts = [...accounts, newAccount];
      localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);
      setSelectedAccountId(newAccount.id);

      // Keep legacy item for backwards compatibility if needed, but primary is system_accounts
      localStorage.setItem('system_keystore', encryptedBlob);

      importWallet(wallet.privateKey, 'System Main');

      // [PERSISTENCE BRIDGE] Synchronize wallet-store so /login page can also unlock
      // without this, the user creates via CoreAuthGate but wallet-store.encryptedVault
      // is empty, causing "Account not found" when they use /login next time.
      try {
        storeSetupPassword(cleanPassword);
      } catch (syncErr) {
        console.warn('[CoreAuthGate] wallet-store sync non-fatal:', syncErr);
      }

      try {
        sessionStorage.setItem('portfolio_unlocked', 'true');
        sessionStorage.setItem('system_wallet_addr', wallet.address.toLowerCase());
        sessionStorage.removeItem('__disconnected__');
        localStorage.removeItem('__disconnected__');
      } catch {}

      // Non-fatal: activateSystemVault uses an injected provider that
      // may not exist on mobile Chrome (iOS/Android). Already saved  proceed regardless.
      try {
        await activateSystemVault(wallet.privateKey, wallet.address);
      } catch (vaultErr: any) {
        console.warn('[CoreAuthGate] Vault activation non-fatal:', vaultErr?.message);
      }

      try {
        const verifyResp = await fetch('/api/auth/system-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: wallet.address })
        });
        if (verifyResp.ok) {
          // Now that cookies are set, index this wallet in the DB
          await cloudSync().catch(() => {});
        }
      } catch (e) {}

      const elapsed = Date.now() - startTime;
      await new Promise(r => setTimeout(r, Math.max(800 - elapsed, 0)));
      toast.success('Wallet creado y asegurado.');
      onComplete();
    } catch (e: any) {
      toast.error('Error de cifrado', { description: e.message });
      setStep('verify');
    }
  };

  const handleLogin = async () => {
    if (accounts.length === 0 && !hasKeystore) {
      toast.error('No wallet found', { description: 'Please create a new wallet first.' });
      setStep('home');
      return;
    }
    
    let targetBlob = '';
    let isLegacyVault = false;
    let targetAccount = accounts.find(a => a.id === selectedAccountId);

    if (targetAccount) {
      targetBlob = targetAccount.encryptedBlob;
      // Heuristic: if it's the legacy vault without address, it might be the old vault pk
      if (targetAccount.id === 'legacy-1' && !localStorage.getItem('system_keystore') && localStorage.getItem('system_vault_v1')) {
        isLegacyVault = true;
      }
    } else {
      const ks = localStorage.getItem('system_keystore');
      const vault = localStorage.getItem('system_vault_v1');
      if (ks) targetBlob = ks;
      else if (vault) { targetBlob = vault; isLegacyVault = true; }
    }

    if (!targetBlob && !isLegacyVault) {
      toast.error('Wallet data missing');
      return;
    }

    if (!password) {
      toast.error('Password required');
      return;
    }
    setStep('encrypting');
    const startTime = Date.now();

    // Yield to React so the spinner renders before CPU-bound decryption
    await new Promise(r => setTimeout(r, 60));

    try {
      let pk: string | null = null;
      let addr: string | null = null;

      // [PERSISTENCE FIX] Sanitize password - prevents mobile trailing-space bug
      const cleanPassword = sanitizePassword(password);

      if (!isLegacyVault) {
        //  Cryptographic UPGRADE: tryDecryptAny handles ALL formats atomically:
        //    New AES-GCM blobs (system v1/v2)
        //    Legacy ethers scrypt keystores (V3)
        //    Transparently migrates legacy keystores to AES-GCM on first login
        try {
          const { plaintext, wasLegacy } = await tryDecryptAny(targetBlob, cleanPassword);

          let walletObj: any;
          if (wasLegacy) {
            // Legacy path: plaintext is the private key
            walletObj = new ethers.Wallet(plaintext);
          } else {
            // New path: plaintext is the 12/24-word mnemonic phrase
            walletObj = ethers.Wallet.fromPhrase(plaintext);
          }
          pk = walletObj.privateKey;
          addr = walletObj.address;

          //  Silent migration: if blob was legacy ethers scrypt, re-encrypt
          //    under the new fast AES-GCM format so future logins are instant.
          if (wasLegacy) {
            try {
              const mnemonic = walletObj.mnemonic?.phrase;
              if (mnemonic) {
                const newBlob = await encryptWithPassword(mnemonic, cleanPassword);
                if (targetAccount) {
                  const updatedAccounts = accounts.map(a => a.id === targetAccount!.id ? { ...a, encryptedBlob: newBlob, address: addr! } : a);
                  localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
                  setAccounts(updatedAccounts);
                }
                localStorage.setItem('system_keystore', newBlob);
                console.log('[CoreAuthGate] Silent migration: ethersAES-GCM complete.');
              }
            } catch (migrateErr) {
              // Non-fatal: keep the old blob if migration fails
              console.warn('[CoreAuthGate] Migration non-fatal:', migrateErr);
            }
          }
        } catch (decryptErr: any) {
          toast.error('Contraseña incorrecta', {
            description: decryptErr.message || 'La contraseña no es correcta. Inténtalo de nuevo.',
          });
          setStep('login');
          return;
        }
      } else {
        // Legacy system_vault_v1 path (pre-AES-GCM era)
        const { readStoredVaultKey } = await import('@/hooks/useSystemConnect');
        const vaultPk = await readStoredVaultKey();
        if (!vaultPk) {
          toast.error('Vault corrupted', { description: 'Please reset and create a new wallet.' });
          setStep('login');
          return;
        }
        const walletObj: any = new ethers.Wallet(vaultPk);
        pk = walletObj.privateKey;
        addr = walletObj.address;
        // Migrate vault_v1  system_accounts (AES-GCM)
        try {
          const mnemonic = walletObj.mnemonic?.phrase;
          const blob = mnemonic
            ? await encryptWithPassword(mnemonic, cleanPassword)
            : await encryptWithPassword(vaultPk, cleanPassword);
          if (targetAccount) {
             const updatedAccounts = accounts.map(a => a.id === targetAccount!.id ? { ...a, encryptedBlob: blob, address: addr! } : a);
             localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
             setAccounts(updatedAccounts);
          }
          localStorage.setItem('system_keystore', blob);
          localStorage.removeItem('system_vault_v1');
        } catch {}
      }

      if (pk && addr) {
        // Update account address if it was missing (e.g. from legacy migration)
        if (targetAccount && !targetAccount.address) {
          const updatedAccounts = accounts.map(a => a.id === targetAccount!.id ? { ...a, address: addr! } : a);
          localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
          setAccounts(updatedAccounts);
        }

        importWallet(pk, 'System Main');

        // [PERSISTENCE BRIDGE] Sync wallet-store so /login page resolves correctly.
        // If user created via CoreAuthGate, wallet-store.encryptedVault was empty.
        // After successful decryption here we re-seal it so next visit auto-resolves.
        try {
          storeSetupPassword(cleanPassword);
        } catch (syncErr) {
          console.warn('[CoreAuthGate] Login wallet-store sync non-fatal:', syncErr);
        }

        try {
          sessionStorage.setItem('portfolio_unlocked', 'true');
          sessionStorage.setItem('system_wallet_addr', addr.toLowerCase());
          sessionStorage.removeItem('__disconnected__');
          localStorage.removeItem('__disconnected__');
        } catch {}


        try {
          await activateSystemVault(pk, addr, { silent: true });
        } catch (vaultErr: any) {
          console.warn('[CoreAuthGate] Login vault activation non-fatal:', vaultErr?.message);
        }


        try {
          const verifyResp = await fetch('/api/auth/system-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: addr })
          });
          if (verifyResp.ok) {
            await cloudSync().catch(() => {});
          }
        } catch (e) {}

        const elapsed = Date.now() - startTime;
        setTimeout(() => {
          // [TOAST GUARD] Only fire success toast once per explicit user login.
          if (!toastFiredRef.current) {
            toastFiredRef.current = true;
            toast.success('Wallet desbloqueado', { description: `${addr!.slice(0, 6)}...${addr!.slice(-4)}` });
          }
          onComplete();
        }, Math.max(500 - elapsed, 0));
      } else {
        throw new Error('No se pudo obtener la clave privada');
      }
    } catch (e: any) {
      const msg = e?.message || '';
      toast.error('Error al desbloquear', { description: msg || 'Inténtalo de nuevo.' });
      setStep('login');
    }
  };

  const handleMnemonicRestore = async () => {
    // Normalize: collapse multiple spaces/newlines to single spaces, trim, lowercase
    const phrase = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ');
    const words = phrase.split(' ');
    if (words.length !== 12 && words.length !== 24) {
      setMnemonicError('La frase debe tener 12 o 24 palabras.');
      return;
    }
    if (password.length < 8) {
      setMnemonicError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setMnemonicError('');
    setStep('encrypting');
    await new Promise(r => setTimeout(r, 60));
    try {
      // Validate phrase by deriving wallet  throws if any word is invalid
      const restoredWallet = ethers.Wallet.fromPhrase(phrase);
      // [PERSISTENCE FIX] Sanitize password before encryption
      const cleanPassword = sanitizePassword(password);

      //  Cryptographic UPGRADE: Encrypt with fast AES-GCM (not ethers scrypt)
      const encryptedBlob = await encryptWithPassword(phrase, cleanPassword);
      
      const restoredAccount: SystemAccount = {
        id: Date.now().toString(),
        name: `Restored ${accounts.length + 1}`,
        address: restoredWallet.address,
        encryptedBlob,
        createdAt: Date.now()
      };
      
      const updatedAccounts = [...accounts, restoredAccount];
      localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);
      setSelectedAccountId(restoredAccount.id);

      localStorage.setItem('system_keystore', encryptedBlob);
      // Clean up any stale legacy vault entries
      localStorage.removeItem('system_vault_v1');

      importWallet(restoredWallet.privateKey, 'System Restored');

      // [PERSISTENCE BRIDGE] Sync wallet-store with cleanPassword so /login works
      try {
        storeSetupPassword(cleanPassword);
      } catch (syncErr) {
        console.warn('[CoreAuthGate] Restore wallet-store sync non-fatal:', syncErr);
      }

      try {
        sessionStorage.setItem('portfolio_unlocked', 'true');
        sessionStorage.setItem('system_wallet_addr', restoredWallet.address.toLowerCase());
        sessionStorage.removeItem('__disconnected__');
        localStorage.removeItem('__disconnected__');
      } catch {}
      try {
        await activateSystemVault(restoredWallet.privateKey, restoredWallet.address);
      } catch {}

      try {
        const verifyResp = await fetch('/api/auth/system-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: restoredWallet.address })
        });
        if (verifyResp.ok) {
          await cloudSync().catch(() => {});
        }
      } catch (e) {}
      toast.success('Wallet restaurado', { description: `${restoredWallet.address.slice(0, 6)}...${restoredWallet.address.slice(-4)}` });
      onComplete();
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      // Surface ethers BIP-39 errors clearly vs generic failures
      const isInvalidPhrase =
        msg.toLowerCase().includes('invalid mnemonic') ||
        msg.toLowerCase().includes('invalid phrase') ||
        msg.toLowerCase().includes('no valid bip39');
      setMnemonicError(
        isInvalidPhrase
          ? 'Frase inválida: una o más palabras no son BIP-39 válidas. Comprueba el orden y la ortografía.'
          : 'Frase mnemónica inválida. Comprueba las palabras e inténtalo de nuevo.',
      );
      setStep('mnemonic');
    }
  };


  const renderContent = () => {
    switch (step) {
      case 'home':
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4 mb-10">
              <div className="w-52 h-52 sm:w-72 sm:h-72 mx-auto mb-0 pointer-events-none">
                 <RemoteLottie path="/system-shots/Lock Loading.json" className="w-full h-full" />
              </div>
              <h1 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase font-sans">{t.home_title}</h1>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed px-4 max-w-xs mx-auto">{t.home_sub}</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => setStep('password')}
                disabled={accounts.length >= 5}
                className="group w-full flex items-center justify-between p-6 rounded-[24px] bg-white text-white hover:bg-[#111] transition-all shadow-[0_8px_30px_rgba(0,0,0,0.12)] active:scale-[0.98] border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-5">
                  <div className="w-13 h-13 rounded-full bg-white/10 flex items-center justify-center border border-white/5 group-hover:scale-105 transition-transform p-3">
                    <Wallet size={22} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-[16px] font-black uppercase tracking-widest flex items-center gap-2">
                       {t.create_vault}
                       {accounts.length > 0 && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{accounts.length}/5</span>}
                    </div>
                    <div className="text-[13px] text-white/50 font-medium mt-0.5 tracking-wide">
                       {accounts.length >= 5 ? 'Maximum accounts reached' : t.create_vault_sub}
                    </div>
                  </div>
                </div>
                <ArrowRight size={20} className="text-white/40 group-hover:text-white transition-colors group-hover:translate-x-1" />
              </button>

              {hasKeystore && (
                <button 
                  onClick={() => setStep('login')}
                  className="group w-full flex items-center justify-between p-6 rounded-[24px] bg-white border border-black/10 hover:border-black/20 transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className="p-3 rounded-full bg-[#FFFFFF] flex items-center justify-center border border-black/5 group-hover:scale-105 transition-transform">
                      <Lock size={22} className="text-[#050505]" />
                    </div>
                    <div className="text-left">
                      <div className="text-[16px] font-black uppercase tracking-widest text-[#050505]">{t.unlock_vault}</div>
                      <div className="text-[13px] text-[#050505]/50 font-medium mt-0.5 tracking-wide">{t.unlock_vault_sub}</div>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-[#050505]/40 group-hover:text-[#050505] transition-colors group-hover:translate-x-1" />
                </button>
              )}

              <button 
                onClick={() => setStep('login')}
                className="group w-full flex items-center justify-between p-6 rounded-[24px] bg-transparent border border-transparent hover:bg-black/5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 rounded-full bg-black/5 flex items-center justify-center border border-black/5 group-hover:scale-105 transition-transform">
                    <Key size={22} className="text-[#050505]" />
                  </div>
                  <div className="text-left">
                    <div className="text-[16px] font-black uppercase tracking-widest text-[#050505]">{t.mint}</div>
                    <div className="text-[13px] text-[#050505]/50 font-medium mt-0.5 tracking-wide">{t.mint_sub}</div>
                  </div>
                </div>
                <ArrowRight size={20} className="text-[#050505]/20 group-hover:text-[#050505] transition-colors group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        );

      case 'login':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4 mb-10">
              <div className="w-20 h-20 bg-[#FFFFFF] border border-black/5 shadow-sm rounded-[24px] mx-auto flex items-center justify-center">
                <Lock size={30} className="text-[#0A0A0A]" strokeWidth={1.5} />
              </div>
              <h1 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase">{t.unlock_title}</h1>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed px-4">{t.unlock_sub}</p>
            </div>
            
            <div className="space-y-4">
              {accounts.length > 0 && (
                <div className="w-full bg-[#FFFFFF] border border-black/10 rounded-[20px] p-2 mb-4">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-black uppercase tracking-widest text-[#0A0A0A]/40">
                    Select Account ({accounts.length}/5)
                  </div>
                  <div className="max-h-[160px] overflow-y-auto space-y-1 mt-2">
                    {accounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-[14px] transition-all ${
                          selectedAccountId === acc.id 
                            ? 'bg-white text-white shadow-md' 
                            : 'bg-transparent text-[#0A0A0A] hover:bg-black/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] ${selectedAccountId === acc.id ? 'bg-white/20' : 'bg-black/5'}`}>
                              {acc.name.substring(0, 2).toUpperCase()}
                           </div>
                           <div className="text-left flex flex-col">
                              <span className="text-[13px] font-black uppercase tracking-wider">{acc.name}</span>
                              <span className={`text-[11px] font-medium ${selectedAccountId === acc.id ? 'text-white/60' : 'text-[#0A0A0A]/40'}`}>
                                {acc.address ? `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` : 'Encrypted Vault'}
                              </span>
                           </div>
                        </div>
                        {selectedAccountId === acc.id && <Check size={16} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder={t.pw_enter}
                className="w-full bg-[#FFFFFF] border border-black/10 shadow-inner rounded-[20px] px-5 py-5 text-[#0A0A0A] text-[16px] font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/30"
                autoFocus
              />
              <button 
                onClick={handleLogin}
                disabled={!password}
                className="w-full py-5 rounded-[20px] bg-white hover:bg-[#111] disabled:opacity-50 transition-all text-white font-black tracking-widest text-[14px] uppercase shadow-lg active:scale-[0.98]"
              >
                {t.decrypt_btn}
              </button>
            </div>
            
            {showResetConfirm ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 space-y-4 bg-red-50/50 p-6 rounded-[24px] border border-red-100">
                <div className="flex items-center gap-3 text-red-600 mb-2">
                   <AlertTriangle size={18} />
                   <p className="text-[13px] font-black uppercase tracking-widest">{t.danger_title}</p>
                </div>
                <p className="text-left text-[13px] font-medium text-red-600/80 leading-relaxed">{t.danger_body}</p>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3.5 rounded-xl border border-black/10 bg-white text-[#050505] text-[13px] font-black uppercase tracking-widest hover:bg-black/5 transition-all">{t.cancel}</button>
                  <button onClick={() => { 
                    if (selectedAccountId) {
                      const updatedAccounts = accounts.filter(a => a.id !== selectedAccountId);
                      localStorage.setItem('system_accounts', JSON.stringify(updatedAccounts));
                      setAccounts(updatedAccounts);
                      if (updatedAccounts.length > 0) {
                        setSelectedAccountId(updatedAccounts[0].id);
                      } else {
                        localStorage.removeItem('system_keystore');
                        setStep('home');
                      }
                      toast.success('Wallet deleted');
                    } else {
                      localStorage.removeItem('system_keystore');
                      localStorage.removeItem('system_accounts');
                      setAccounts([]);
                      setStep('home'); 
                    }
                    setShowResetConfirm(false); 
                  }} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white text-[13px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-md">{t.purge}</button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-2 pt-4">
                <button onClick={() => setShowResetConfirm(true)} className="w-full text-center text-[13px] font-black uppercase tracking-widest text-[#050505]/40 hover:text-[#050505] transition-colors">
                  {t.forgot}
                </button>
                <button
                  onClick={() => { setPassword(''); setMnemonicInput(''); setMnemonicError(''); setStep('mnemonic'); }}
                  className="w-full text-center text-[12px] font-bold uppercase tracking-widest text-indigo-500/60 hover:text-indigo-500 transition-colors"
                >
                   Restaurar con frase mnemónica
                </button>
              </div>
            )}
          </div>
        );

      case 'mnemonic':
        return (
          <div className="space-y-6">
            <button onClick={() => setStep('login')} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors mb-2"><ChevronLeft size={20}/></button>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-[#0A0A0A] tracking-tighter uppercase">Restaurar Wallet</h2>
              <p className="text-[14px] text-[#0A0A0A]/50 font-medium leading-relaxed">Introduce tu frase de 12 palabras y una nueva contraseña para restaurar el acceso.</p>
            </div>
            <div className="space-y-4">
              <textarea
                value={mnemonicInput}
                onChange={e => { setMnemonicInput(e.target.value); setMnemonicError(''); }}
                placeholder="palabra1 palabra2 palabra3 ... palabra12"
                rows={4}
                className="w-full bg-[#FFFFFF] border border-black/10 shadow-inner rounded-[20px] px-5 py-4 text-[#0A0A0A] text-[14px] font-mono font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/20 resize-none"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                className="w-full bg-[#FFFFFF] border border-black/10 shadow-inner rounded-[20px] px-5 py-5 text-[#0A0A0A] text-[16px] font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/30"
              />
              {mnemonicError && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 rounded-xl px-4 py-3 text-[13px] font-medium">
                  <AlertTriangle size={14} className="shrink-0" />
                  {mnemonicError}
                </div>
              )}
              <button
                onClick={handleMnemonicRestore}
                disabled={mnemonicInput.trim().split(/\s+/).length < 12 || password.length < 8}
                className="w-full py-5 rounded-[20px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-all text-white font-black tracking-widest text-[14px] uppercase shadow-lg active:scale-[0.98]"
              >
                 Restaurar y Acceder
              </button>
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="space-y-6">
            <button onClick={() => setStep('home')} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors mb-2"><ChevronLeft size={20}/></button>
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase">{t.password_title}</h2>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed">{t.password_sub}</p>
            </div>

            <div className="space-y-5 pt-4">
              <input 
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t.pw_placeholder}
                className="w-full bg-[#FFFFFF] border border-black/10 shadow-inner rounded-[20px] px-5 py-5 text-[#0A0A0A] text-[16px] font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/30"
              />
              <input 
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t.pw_confirm}
                className="w-full bg-[#FFFFFF] border border-black/10 shadow-inner rounded-[20px] px-5 py-5 text-[#0A0A0A] text-[16px] font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/30"
              />
              
              <label className="flex items-start gap-4 p-5 border border-black/5 bg-[#FFFFFF] rounded-[22px] cursor-pointer hover:border-black/10 transition-colors mt-6 group">
                <div className="pt-0.5">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${termsAccepted ? 'bg-white border-[#050505]' : 'bg-white border-black/20 group-hover:border-black/40'}`}>
                    {termsAccepted && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="sr-only" />
                </div>
                <span className="text-[14px] text-[#050505]/60 font-medium leading-relaxed">{t.terms}</span>
              </label>

              <button 
                onClick={handleCreatePassword}
                disabled={!termsAccepted || password.length < 8 || password !== confirmPassword}
                className="w-full py-5 mt-2 rounded-[20px] bg-white text-white font-black tracking-widest text-[14px] uppercase disabled:opacity-40 disabled:scale-100 transition-all shadow-lg active:scale-[0.98]"
              >
                {t.create_btn}
              </button>
            </div>
          </div>
        );

      case 'secure':
        return <SecureStepPanel t={t} onBack={() => setStep('password')} onProceed={() => setStep('reveal')} />;

      case 'reveal':
        return (
          <div className="space-y-6">
            <button onClick={() => setStep('password')} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors mb-2"><ChevronLeft size={20}/></button>
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase">{t.reveal_title}</h2>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed">{t.reveal_sub}</p>
            </div>

            <div className="relative border border-black/5 rounded-[26px] p-7 bg-[#FFFFFF] min-h-[280px] flex items-center justify-center overflow-hidden">
              {!revealed ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
                  <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-5">
                    <EyeOff size={26} className="text-[#050505]" />
                  </div>
                  <p className="text-[14px] text-[#050505] font-black uppercase tracking-widest mb-1">{t.tap_reveal}</p>
                  <p className="text-[13px] text-[#050505]/50 font-medium mb-6">{t.no_one}</p>
                  <button 
                    onClick={() => setRevealed(true)}
                    className="px-8 py-4 rounded-[16px] bg-white text-white transition-all font-black text-[12px] uppercase tracking-widest active:scale-[0.96] shadow-md"
                  >
                    {t.show_words}
                  </button>
                </div>
              ) : null}
              
              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 w-full transition-all duration-700 ${revealed ? 'opacity-100 scale-100 filter-none' : 'opacity-0 scale-95 blur-md select-none pointer-events-none'}`}>
                {wallet?.mnemonic?.phrase?.split(' ')?.map((word, i) => (
                  <div key={i} className="flex flex-col bg-white border border-black/5 rounded-xl overflow-hidden shadow-sm">
                    <div className="w-full py-1 bg-black/[0.03] text-[10px] text-[#050505]/40 font-black tracking-widest text-center border-b border-black/5">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 py-3 text-[14px] text-[#050505] font-bold tracking-wide text-center">
                      {word}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={() => setStep('verify')}
                disabled={!revealed}
                className="w-full px-10 py-4 rounded-[18px] bg-white text-white font-black tracking-widest text-[13px] uppercase disabled:opacity-40 transition-all shadow-md active:scale-[0.98]"
              >
                {t.proceed}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(wallet?.mnemonic?.phrase || ''); toast.success(t.copy); }} className="w-full text-center text-[#050505]/40 hover:text-[#050505] text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors py-2">
                <Copy size={14} /> {t.copy}
              </button>
            </div>
          </div>
        );

      case 'verify':
        return (
          <div className="space-y-6">
            <button onClick={() => setStep('reveal')} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-[#0A0A0A] hover:bg-black/10 transition-colors mb-2"><ChevronLeft size={20}/></button>
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-[#0A0A0A] tracking-tighter uppercase">{t.verify_title}</h2>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium leading-relaxed">{t.verify_sub}</p>
            </div>

            <div className="space-y-4 pt-2">
              {verifyIndices.map((wordIndex, i) => (
                <div key={wordIndex} className="space-y-2 relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-widest text-[#050505]/20 pointer-events-none">
                    {t.word} {String(wordIndex + 1).padStart(2, '0')}
                  </div>
                  <input
                    type="text"
                    value={verifyInputs[i]}
                    onChange={(e) => {
                      const newInputs = [...verifyInputs];
                      newInputs[i] = e.target.value.toLowerCase().trim();
                      setVerifyInputs(newInputs);
                    }}
                    className="w-full bg-[#FFFFFF] border border-black/5 shadow-inner rounded-[20px] pl-5 pr-24 py-5 text-[#0A0A0A] text-[15px] font-bold focus:outline-none focus:border-[#0A0A0A] focus:bg-white transition-all placeholder:font-medium placeholder:text-black/30"
                    placeholder="..."
                  />
                </div>
              ))}
            </div>

            <button 
              onClick={handleVerify}
              disabled={verifyInputs.some(v => v.length < 2)}
              className="w-full py-5 mt-6 rounded-[20px] bg-white text-white font-black tracking-widest text-[14px] uppercase disabled:opacity-40 transition-all shadow-lg active:scale-[0.98]"
            >
              {t.verify_btn}
            </button>
          </div>
        );

      case 'encrypting': {
        // Determine mode: if keystore existed BEFORE we started, this is a login decryption.
        // We pass this info via the step that triggered encrypting.
        // Heuristic: if the wallet object is null (no new wallet generated), we are decrypting.
        const isDecryptingMode = wallet === null;
        return (
          <div className="flex flex-col items-center justify-center py-20 space-y-10 relative">
            <div className="relative w-64 h-64 flex items-center justify-center -mt-8">
               <RemoteLottie path="/system-shots/Ledger Mission.json" className="w-full h-full object-contain opacity-100" />
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-[24px] font-black text-[#0A0A0A] tracking-tighter uppercase">
                {isDecryptingMode ? t.decrypting : t.encrypting}
              </h2>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium">
                {isDecryptingMode ? t.decrypting_sub : t.encrypting_sub}
              </p>
            </div>
          </div>
        );
      }
      case 'generating_wallet':
        return (
          <div className="flex flex-col items-center justify-center py-20 space-y-10 relative">
            <div className="relative w-64 h-64 flex items-center justify-center -mt-8">
               <RemoteLottie path="/system-shots/block abstract.json" className="w-full h-full object-contain opacity-100" loop={true} />
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-[26px] font-black text-[#0A0A0A] tracking-tighter uppercase">Generating Wallet</h2>
              <p className="text-[15px] text-[#0A0A0A]/50 font-medium">Creating your secure wallet on this device...</p>
              
              {/* Terminal Progress Bar */}
              <div className="w-full max-w-[200px] mx-auto mt-4">
                <div className="h-[2px] w-full bg-black/10 overflow-hidden rounded-full">
                   <div 
                     className="h-full bg-white transition-all duration-75 ease-linear"
                     style={{ width: `${loadingProgress}%` }}
                   />
                </div>
                <div className="text-[10px] font-mono text-black/30 mt-2 font-black uppercase tracking-[0.2em] flex justify-between">
                  <span>Encrypting</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'transaction_complete':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-56 h-56 mx-auto mb-6">
              <RemoteLottie path="/system-shots/Transaction Complete.json" className="w-full h-full object-contain" speed={1.15} />
            </div>
            <h2 className="text-2xl font-black text-emerald-500 tracking-tighter uppercase">
              Wallet Created
            </h2>
          </div>
        );

    }
  };

  return (
    <div className="flex items-start sm:items-center justify-center px-4 sm:px-6 min-h-[100vh] w-full relative overflow-y-auto py-8 sm:py-12">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
         <RemoteLottie path="/system-shots/Airplane Lottie Animation (1).json" className="w-full h-full object-cover" loop={false} />
      </div>
      <motion.div 
        key={step}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -10 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[560px] bg-white/90 backdrop-blur-[40px] rounded-[28px] sm:rounded-[36px] border border-black/[0.04] shadow-[0_24px_80px_rgba(0,0,0,0.08)] p-5 sm:p-10 relative z-10 will-change-transform"
      >
        <LangSelector lang={lang} setLang={setLang} />
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
