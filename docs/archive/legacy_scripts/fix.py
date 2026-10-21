import sys, re

with open('components/terminal/LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. maxAttempts
content = content.replace('const maxAttempts = 4;', 'const maxAttempts = 2;')

# 2. Add safety reset
content = content.replace(
    '} else {\n          console.warn([Ledger Chat] Init attempt  failed due to inactivity/network timeout, retrying..., err);\n        }\n      }\n    }\n  }, [address, isMobile, signMessageAsync, isSystemHandshake, loadConversations, isLocalSystemWallet]);',
    '} else {\n          console.warn([Ledger Chat] Init attempt  failed due to inactivity/network timeout, retrying..., err);\n        }\n      }\n    }\n    // [SAFETY] Always reset the in-flight lock, even if we somehow exit the while loop without hitting return/error\n    setIsInitializing(false);\n    initInFlight.current = false;\n  }, [address, isMobile, signMessageAsync, isSystemHandshake, loadConversations, isLocalSystemWallet]);'
)

# 3. Replace auto-init useEffect
content = content.replace(
    'if (isConnected && address && !isEmailUser && !client && !initInFlight.current && !initError) {\n      initClient();\n    }',
    'if (isConnected && address && !isEmailUser && !client && !initInFlight.current && !initError) {\n      initClient();\n      // [SAFETY TIMEOUT] If init hasn\'t resolved in 45s, reset state to unblock the UI\n      const safetyTimer = setTimeout(() => {\n        if (initInFlight.current) {\n          console.warn(\'[LedgerChat] Init safety timeout reached - resetting state\');\n          setIsInitializing(false);\n          initInFlight.current = false;\n          setInitError(\'Connection timed out. Please tap "Enter Ledger Chat" to retry.\');\n        }\n      }, 45_000);\n      return () => clearTimeout(safetyTimer);\n    }'
)

# 4. Remove Identity Mint block
content = re.sub(
    r'\s*// Identity Mint logic for WalletConnect.*?\} catch \(e\) \{\s*console\.error\(\'Identity Airdrop Failed:\', e\);\s*// Do NOT remove the localStorage key on error.*?\}\s*\}\s*\}',
    '',
    content,
    flags=re.DOTALL
)

# 5. Remove aztecNative usage
content = re.sub(
    r'\s*const \{ spendQDs, balance, aztecAddress, refresh: refreshBalance \} = aztecNative;\s*const refreshBalanceRef = useRef<.*?>\(async \(\) => \{\}\);\s*useEffect\(\(\) => \{ refreshBalanceRef\.current = refreshBalance; \}, \[refreshBalance\]\);',
    '',
    content,
    flags=re.DOTALL
)

# 6. Update Avatar component
content = re.sub(
    r'(window\.removeEventListener\(\'ledger_settings_update\', handler\);\s*\}, \[\]\);)',
    r'\1\n\n  React.useEffect(() => {\n    if (!isMe && address && typeof window !== \'undefined\') {\n      const cached = localStorage.getItem(\'peer_avatar_\' + address);\n      if (cached) { setSavedAvatar(cached); return; }\n      fetch(/api/user/search?q=).then(res => res.json()).then(data => {\n        if (data.users && data.users.length > 0 && data.users[0].avatarUrl) {\n          setSavedAvatar(data.users[0].avatarUrl);\n          localStorage.setItem(\'peer_avatar_\' + address, data.users[0].avatarUrl);\n        }\n      }).catch(e => console.error(e));\n    }\n  }, [address, isMe]);',
    content
)

# 7. Change if (isMe && savedAvatar) to if (savedAvatar)
content = content.replace('if (isMe && savedAvatar) {', 'if (savedAvatar) {')

with open('components/terminal/LedgerChatV2.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
