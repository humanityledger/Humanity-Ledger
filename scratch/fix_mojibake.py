import sys

def run():
    with open('components/terminal/LedgerChat.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_block = """              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {[
                  { 
                    label: 'End-to-End Encrypted',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    ),
                    color: 'text-blue-500 bg-blue-50'
                  },
                  { 
                    label: 'Decentralized Network',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    ),
                    color: 'text-purple-500 bg-purple-50'
                  },
                  { 
                    label: 'Burn on Read',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                      </svg>
                    ),
                    color: 'text-orange-500 bg-orange-50'
                  },
                  { 
                    label: 'Send QD Tokens',
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/>
                      </svg>
                    ),
                    color: 'text-emerald-500 bg-emerald-50'
                  }
                ].map((f) => (
                  <div key={f.label} className="bg-white rounded-2xl p-4 border border-black/[0.06] shadow-sm flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color}`}>
                      {f.icon}
                    </div>
                    <span className="text-[11px] font-semibold text-[#1C1C1E]/60 leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>\n"""

    start_idx = -1
    end_idx = -1

    for i, line in enumerate(lines):
        if '<div className="grid grid-cols-2 gap-4 w-full max-w-sm">' in line:
            start_idx = i
            break
            
    for i in range(start_idx, len(lines)):
        if "              </div>" in lines[i]:
            end_idx = i
            break
            
    if start_idx != -1 and end_idx != -1:
        lines = lines[:start_idx] + [new_block] + lines[end_idx+1:]
        with open('components/terminal/LedgerChat.tsx', 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Success")
    else:
        print("Failed to find boundaries")

run()
