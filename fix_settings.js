const fs = require('fs');

const path = 'components/chat/CommunityView.tsx';
let content = fs.readFileSync(path, 'utf8');

const hook = `const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(community?.name || '');
  const [editDesc, setEditDesc] = useState(community?.description || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ communityId: community.id, action: 'UPDATE_INFO', name: editName, description: editDesc }),
      });
      if (res.ok) {
        toast.success('Profile updated');
        setIsEditingProfile(false);
        community.name = editName;
        community.description = editDesc;
      } else toast.error('Failed to update');
    } catch (e) { toast.error('Error saving'); }
    setSavingProfile(false);
  };`;

content = content.replace('const [savingPrivacy, setSavingPrivacy] = useState(false);', 'const [savingPrivacy, setSavingPrivacy] = useState(false);\n' + hook);

const ui = `
      {/* Group Profile Editor */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-black/[0.04] bg-[#FAFAFA]/50 flex justify-between items-center">
          <p className="text-[12px] font-black uppercase tracking-[0.15em] text-blue-500">Group Profile</p>
          {!isEditingProfile ? (
            <button onClick={() => setIsEditingProfile(true)} className="text-[12px] font-bold text-[#007AFF]">Edit</button>
          ) : (
            <button onClick={saveProfile} disabled={savingProfile} className="text-[12px] font-bold text-white bg-[#007AFF] px-3 py-1 rounded-full">{savingProfile ? 'Saving...' : 'Save'}</button>
          )}
        </div>
        <div className="p-6 flex flex-col gap-4">
          {!isEditingProfile ? (
            <>
              <div><p className="text-[11px] font-bold text-black/40 uppercase mb-1">Name</p><p className="text-[15px] font-bold">{community?.name}</p></div>
              <div><p className="text-[11px] font-bold text-black/40 uppercase mb-1">Description</p><p className="text-[14px]">{community?.description || 'No description'}</p></div>
            </>
          ) : (
            <>
              <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full bg-black/5 rounded-xl px-4 py-3 outline-none font-bold" placeholder="Group Name" />
              <textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="w-full bg-black/5 rounded-xl px-4 py-3 outline-none min-h-[80px]" placeholder="Group Description" />
            </>
          )}
        </div>
      </div>
`;

content = content.replace('{/* Privacy & Invite Links */}', ui + '\n      {/* Privacy & Invite Links */}');
fs.writeFileSync(path, content);
console.log('Fixed settings panel');
