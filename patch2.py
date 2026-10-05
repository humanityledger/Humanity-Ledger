import re

with open("components/landing/ImmersiveManifestoLanding.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if "import { LedgerShowcase }" not in content:
    content = content.replace("import { HLLogo } from '@/components/shared/HLLogo';", "import { HLLogo } from '@/components/shared/HLLogo';\nimport { LedgerShowcase } from './LedgerShowcase';")

# Replace section 3
pattern = re.compile(r'<section id="how-it-works".*?<\/section>', re.DOTALL)
content = pattern.sub('<LedgerShowcase />', content)

# Remove the comment just before it too to be clean
pattern2 = re.compile(r'\{\/\*.*?SECTION 3.*?\*\/\}', re.DOTALL)
content = pattern2.sub('', content)

with open("components/landing/ImmersiveManifestoLanding.tsx", "w", encoding="utf-8") as f:
    f.write(content)
