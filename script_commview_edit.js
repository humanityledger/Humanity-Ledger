const fs = require('fs');
let code = fs.readFileSync('components/chat/CommunityView.tsx', 'utf8');

// Add editPost state
code = code.replace(
  `const [showEditor, setShowEditor] = useState(false);`,
  `const [showEditor, setShowEditor] = useState(false);\n  const [editingPost, setEditingPost] = useState<any>(null);`
);

// Open editor for new post
code = code.replace(
  `onClick={() => setShowEditor(true)}`,
  `onClick={() => { setEditingPost(null); setShowEditor(true); }}`
);

// Modify the post renderer to add Edit button
const postStart = `<div className="bg-[#FAFAFA] px-6 py-3 border-t border-black/5 flex items-center justify-between">`;
const postWithEdit = `<div className="bg-[#FAFAFA] px-6 py-3 border-t border-black/5 flex items-center justify-between">
                        {post.authorAddress?.toLowerCase() === myAddress?.toLowerCase() && (
                          <button 
                            onClick={() => { setEditingPost(post); setShowEditor(true); }}
                            className="text-[12px] font-bold text-black/50 hover:text-black flex items-center gap-1 bg-black/5 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Edit size={14} /> Edit
                          </button>
                        )}`;
code = code.replace(postStart, postWithEdit);

// Modify RichPostEditorModal call
code = code.replace(
  `<RichPostEditorModal \n        open={showEditor} \n        onClose={() => setShowEditor(false)} \n        communityId={communityId}\n        myAddress={myAddress}\n        communityName={community?.name}\n        onSuccess={fetchData}\n      />`,
  `<RichPostEditorModal \n        open={showEditor} \n        onClose={() => { setShowEditor(false); setEditingPost(null); }} \n        communityId={communityId}\n        myAddress={myAddress}\n        communityName={community?.name}\n        onSuccess={fetchData}\n        postToEdit={editingPost}\n      />`
);

fs.writeFileSync('components/chat/CommunityView.tsx', code);
console.log('CommunityView updated with Edit button');
