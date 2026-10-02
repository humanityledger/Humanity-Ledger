const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace(/model CommunityMessage \{[\s\S]*?\}/g, '// Removed: CommunityMessage (Centralized Storage)');
schema = schema.replace(/messages\s+CommunityMessage\[\]/g, '// messages CommunityMessage[]');

schema = schema.replace(/model PendingChatMessage \{[\s\S]*?\}/g, '// Removed: PendingChatMessage (Centralized Offline Queue)');

schema = schema.replace(/encryptedPrivateKey\s+String\?/g, '// encryptedPrivateKey String? (Removed for Non-Custodial Sovereign compliance)');

schema = schema.replace(/model UserSessionLog \{[\s\S]*?\}/g, '// Removed: UserSessionLog (Telemetry / Analytics)');
schema = schema.replace(/model [\w]+ \{[^}]*@@map\("login_geo_events"\)[\s\S]*?\}/g, '// Removed: login_geo_events');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema purged.');
