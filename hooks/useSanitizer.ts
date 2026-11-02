import DOMPurify from 'isomorphic-dompurify';

// B-028: Hook registered once globally, not on every function invocation
let hookRegistered = false;
function ensureHook() {
    if (hookRegistered) return;
    hookRegistered = true;
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if ('target' in node && node.getAttribute('target') === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
}
ensureHook();

const SANITIZE_CONFIG = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'br', 'hr', 'img', 'svg', 'path'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'viewBox', 'd', 'fill', 'xmlns'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'foreignObject', 'use', 'animate'],
};

/**
 * B-028: Helper to securely sanitize HTML content in both SSR (Node.js) and browser.
 * Cleans `<img/src=x/onerror=alert(1)>` on the server before rendering.
 */
export const sanitizeHTML = (content: string): string => {
    if (!content) return '';
    return DOMPurify.sanitize(content, SANITIZE_CONFIG);
};

/**
 * Helper for dangerouslySetInnerHTML
 */
export const safeHTML = (content: string) => {
    return { __html: sanitizeHTML(content) };
};
