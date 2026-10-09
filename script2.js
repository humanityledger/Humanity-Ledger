const fs = require('fs');
let code = fs.readFileSync('components/chat/CommunityView.tsx', 'utf8');

const replacement = const savePermissions = async (newPerms: any) => {
    const { id, communityId, createdAt, updatedAt, ...cleanPerms } = newPerms;
    setPermissions(newPerms);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId: community?.id, action: 'UPDATE_PERMISSIONS', permissions: cleanPerms }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Permissions updated');
    } catch (e) {
      toast.error('Failed to update permissions');
    }
  };;

code = code.replace(/const savePermissions = async \(newPerms: any\) => \{[\s\S]*?toast\.error\('Failed to update permissions'\);\s*\}\s*\};/, replacement);
fs.writeFileSync('components/chat/CommunityView.tsx', code);
console.log('Done');
