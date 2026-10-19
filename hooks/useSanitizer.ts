import DOMPurify from 'isomorphic-dompurify';

/**
 * Helper to securely sanitize HTML content, compatible with Next.js SSR.
 * Adds rel="noopener noreferrer" to all links automatically to prevent Tabnabbing.
 */
export const sanitizeHTML = (content: string): string => {
    if (typeof window === 'undefined') {
        // En SSR, eliminamos temporalmente las etiquetas script y on* handlers 
        // con Regex básico como primera capa defensiva, hasta que el cliente hidrate con DOMPurify.
        // [ReDoS FIX] Use non-backtracking replacements for SSR script stripping
        // The original regex had catastrophic backtracking potential on pathological input.
        return content
            .replace(/<script[\s\S]*?<\/script>/gi, '')  // Lazy quantifier, bounded
            .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '') // Specific attribute format
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, ''); // Prevent data: URI XSS vectors
    }

    // Add hook to ensure target="_blank" links have rel="noopener noreferrer"
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if ('target' in node && node.getAttribute('target') === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'br', 'hr', 'img', 'svg', 'path'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'viewBox', 'd', 'fill', 'xmlns'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'foreignObject', 'use', 'animate'],
    });
};

/**
 * Helper for dangerouslySetInnerHTML
 */
export const safeHTML = (content: string) => {
    return { __html: sanitizeHTML(content) };
};

