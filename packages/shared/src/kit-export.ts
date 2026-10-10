import { COLOR_ROLES, type MobileKit } from './types';

export type ExportFormat = 'css' | 'json';
const label = (role: string) => role[0].toUpperCase() + role.slice(1);
const entries = (kit: MobileKit) => COLOR_ROLES.flatMap(role => {
  const hex = kit.roles[role];
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? [[role, hex.toLowerCase()] as const] : [];
});
export function copyKitText(kit: MobileKit): string {
  return [kit.title, '', ...entries(kit).map(([role, hex]) => `${label(role)}: ${hex}`),
    ...(kit.brief.status === 'ready' && kit.brief.text ? ['', kit.brief.text] : [])].join('\n');
}
export function exportKitText(kit: MobileKit, format: ExportFormat): string {
  if (format === 'css') return [':root {', ...entries(kit).map(([role, hex]) => `  --color-${role}: ${hex};`), '}', ''].join('\n');
  // No signed photo URL, owner ID, or fabricated fallback colors in a portable kit.
  return JSON.stringify({ schemaVersion: 1, name: kit.title,
    colors: Object.fromEntries(entries(kit)),
    description: kit.brief.status === 'ready' ? kit.brief.text : null,
  }, null, 2) + '\n';
}
export function exportKitFilename(kit: Pick<MobileKit, 'title'>, format: ExportFormat): string {
  const name = kit.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'inspiration';
  return `${name}.${format}`;
}
