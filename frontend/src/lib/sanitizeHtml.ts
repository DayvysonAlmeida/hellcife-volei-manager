import DOMPurify from 'dompurify';

/** Sanitiza HTML vindo da API antes de usar em dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
