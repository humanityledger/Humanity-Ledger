import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    schema = f.read()

# Remove CommunityMessage
schema = re.sub(r'model CommunityMessage \{.*?\}', '// Removed: CommunityMessage (Centralized Storage)', schema, flags=re.DOTALL)
schema = re.sub(r'messages\s+CommunityMessage\[\]', '// messages CommunityMessage[]', schema)

# Remove PendingChatMessage
schema = re.sub(r'model PendingChatMessage \{.*?\}', '// Removed: PendingChatMessage (Centralized Offline Queue)', schema, flags=re.DOTALL)

# Make email optional
schema = re.sub(r'email\s+String\s+@unique', 'email String? @unique', schema)

# Remove UserSessionLog and login_geo_events
schema = re.sub(r'model UserSessionLog \{.*?\}', '// Removed: UserSessionLog (Telemetry / Analytics)', schema, flags=re.DOTALL)
schema = re.sub(r'model [\w]+ \{[^}]*@@map\("login_geo_events"\).*?\}', '// Removed: login_geo_events', schema, flags=re.DOTALL)

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(schema)

print("Schema purged successfully via Python.")
