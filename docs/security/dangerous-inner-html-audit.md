# Audit of dangerouslySetInnerHTML Usages

| Location | Purpose | Sanitization Control | Status |
|---|---|---|---|
| `components/privacy/MermaidDiagram.tsx` | Rendering Mermaid SVG diagrams | Sanitized via DOMPurify + strict securityLevel | Safe |
| `hooks/useSanitizer.ts` | HTML content formatting | isomorphic-dompurify in SSR & client | Safe |
| `app/layout.tsx` | Schema.org JSON-LD structured data | Static serialized JSON literal | Safe |
| `components/chat/MessageBubble.tsx` | Code highlighting | Sanitized markdown tokens | Safe |
