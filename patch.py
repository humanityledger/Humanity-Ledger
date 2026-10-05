import re

with open("components/landing/ImmersiveManifestoLanding.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if "LedgerShowcase" not in content:
    content = content.replace("import { HLLogo } from '@/components/shared/HLLogo';", "import { HLLogo } from '@/components/shared/HLLogo';\nimport { LedgerShowcase } from './LedgerShowcase';")

# Replace section 3
pattern = re.compile(r'\{\/\*  SECTION 3 - HOW IT WORKS.*?<\/section>', re.DOTALL)
content = pattern.sub('<LedgerShowcase />', content)

with open("components/landing/ImmersiveManifestoLanding.tsx", "w", encoding="utf-8") as f:
    f.write(content)
