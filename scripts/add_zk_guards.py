import sys, re

components = [
    "ZkCommunityTreasury",
    "ZkComplianceModal", 
    "ZkMpcCeremony",
    "ZkPrivacyScore",
    "ZkSequencerDashboard",
]

for comp in components:
    path = f"components/zk/{comp}.tsx"
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        
        if 'if (!isZkEnabled) return null' in content:
            print(f"{comp}: already has guard")
            continue
        
        # Add guard to the default export or main function
        # Find the main function and add early return
        pattern = rf"export (default )?function {comp}\s*\("
        match = re.search(pattern, content)
        if match:
            # Find the opening brace
            start = match.end()
            brace_pos = content.find('{', start)
            if brace_pos != -1:
                insert = "\n  if (!isZkEnabled) return null;\n"
                content = content[:brace_pos+1] + insert + content[brace_pos+1:]
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"{comp}: added guard")
        else:
            print(f"{comp}: export not found, skipping")
    except FileNotFoundError:
        print(f"{comp}: file not found")
