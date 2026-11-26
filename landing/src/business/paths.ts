// Feature 025: the business page's addresses, with and without the rewrite (.htaccess maps the clean
// ones to the prerendered files).
export const BUSINESS_PATHS = ['/negocios', '/negocios.html', '/en/business', '/en/business.html'] as const;

export function isBusinessPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return (BUSINESS_PATHS as readonly string[]).includes(p);
}
