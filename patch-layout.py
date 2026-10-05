import re

with open("components/terminal/LedgerChatV2.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We want to find the exact block:
#     {/* Solid white container - two-panel layout: sidebar (left) + chat (right) */}
#     <div className={`relative flex flex-row flex-1 min-h-0 w-full overflow-hidden shadow-sm ${(showScanner || showMyQR || showProfile) ? 'overflow-visible' : ''}`} style={{ 
#     borderRadius: isMobile ? 0 : '0',
#     ...bgStyle,
#     fontFamily,
#   }}>
#     {/*  Sidebar: Conversation List - fixed width on desktop, full screen on mobile when no chat is active  */}
#     <div className={`${showList ? 'flex' : 'hidden md:flex'} w-full md:w-80 lg:w-96 flex-col border-r border-black/[0.08] bg-white shrink-0 h-full overflow-hidden`}>

pattern = re.compile(
    r'\{\/\*\s*Solid white container - two-panel layout.*?<div className=\{`\$\{showList \? \'flex\' : \'hidden md:flex\'\} w-full md:w-80 lg:w-96 flex-col border-r border-black/\[0\.08\] bg-white shrink-0 h-full overflow-hidden`\}>',
    re.DOTALL
)

replacement = """{/* Solid desktop container - Signal / WhatsApp Web architecture */}
      <div className={`relative flex flex-row flex-1 min-h-0 w-full overflow-hidden shadow-sm ${(showScanner || showMyQR || showProfile) ? 'overflow-visible' : ''}`} style={{ 
      borderRadius: isMobile ? 0 : '0',
      backgroundColor: '#EBE5DC', 
      fontFamily,
    }}>
      {/*  Sidebar: Conversation List - Fixed 400px width on desktop  */}
      <div className={`${showList ? 'flex' : 'hidden md:flex'} w-full md:w-[400px] flex-col border-r border-[#D1D7DB] bg-[#FFFFFF] shrink-0 h-full overflow-hidden z-10 shadow-sm`}>"""

new_content = pattern.sub(replacement, content)

# Check if the right pane has bgStyle, if not we apply it to the main content area wrapper
pattern2 = re.compile(
    r'(<div className="flex-1 overflow-y-auto flex flex-col bg-\[\#F2F2F7\]">)',
    re.DOTALL
)

replacement2 = r'<div className="flex-1 overflow-y-auto flex flex-col bg-[#F2F2F7]" style={bgStyle}>'
new_content = pattern2.sub(replacement2, new_content)


with open("components/terminal/LedgerChatV2.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Layout updated.")
