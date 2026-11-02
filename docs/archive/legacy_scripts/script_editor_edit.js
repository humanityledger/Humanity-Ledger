const fs = require('fs');
let code = fs.readFileSync('components/chat/RichPostEditor.tsx', 'utf8');

// Update Props interface
code = code.replace(
  `export interface RichPostEditorModalProps {`,
  `export interface RichPostEditorModalProps {\n  postToEdit?: any;`
);

// Update Modal signature
code = code.replace(
  `export function RichPostEditorModal({`,
  `export function RichPostEditorModal({\n  postToEdit,`
);

// Pass to RichPostEditor
code = code.replace(
  `<RichPostEditor\n          title={communityName ? \`Post in \${communityName}\` : 'New Post'}\n          communityName={communityName}`,
  `<RichPostEditor\n          title={postToEdit ? 'Edit Post' : (communityName ? \`Post in \${communityName}\` : 'New Post')}\n          communityName={communityName}\n          initialTitle={postToEdit?.title || ''}\n          initialContent={postToEdit?.contentHtml || postToEdit?.content || ''}`
);

// Update handlePublish in Modal to do POST or PATCH
const oldHandle = `const res = await fetch('/api/chat/communities/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-web3-address': myAddress
        },
        body: JSON.stringify({
          communityId,
          title: content.text.trim().split('\\n')[0].slice(0, 50),
          content: content.text,
          contentHtml: content.html,
          plainText: content.text,
          authorAddress: myAddress.toLowerCase()
        })
      });`;

const newHandle = `const res = await fetch('/api/chat/communities/posts', {
        method: postToEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-web3-address': myAddress
        },
        body: JSON.stringify({
          communityId,
          postId: postToEdit?.id,
          title: content.text.trim().split('\\n')[0].slice(0, 50), // Auto-title fallback if empty
          content: content.text,
          contentHtml: content.html,
          plainText: content.text,
          authorAddress: myAddress.toLowerCase()
        })
      });`;

code = code.replace(oldHandle, newHandle);

fs.writeFileSync('components/chat/RichPostEditor.tsx', code);
console.log('RichPostEditor updated with edit support');
