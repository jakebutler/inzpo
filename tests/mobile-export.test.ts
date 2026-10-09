import { expect, it } from 'vitest';
import { copyKitText, emptyRoles, exportKitFilename, exportKitText, type MobileKit } from '@inzpo/shared';
const kit: MobileKit = { id: 'private-id', title: 'Blue / Bowl */', photo: { url: 'https://private.example/signed', width: 2, height: 2, placeholder: null },
  roles: { ...emptyRoles(), primary: '#123ABC', background: '#FEFEFE' }, colors: [], collectionIds: [],
  brief: { status: 'ready', text: 'Blue glaze feels cool and quiet.', namedColors: [], namedHexes: [], stub: false, updatedAt: 1 } };
it('exports portable real roles and description without signed URLs or empty-role substitutes', () => {
  const json = exportKitText(kit, 'json');
  expect(JSON.parse(json)).toEqual({ schemaVersion: 1, name: kit.title, colors: { primary: '#123abc', background: '#fefefe' }, description: kit.brief.text });
  expect(json).not.toContain('private');
  expect(exportKitText(kit, 'css')).toBe(':root {\n  --color-primary: #123abc;\n  --color-background: #fefefe;\n}\n');
  expect(exportKitFilename(kit, 'css')).toBe('blue-bowl.css');
});
it('copy carries hexes and actual description; pending descriptions never fabricate prose', () => {
  expect(copyKitText(kit)).toContain('Primary: #123abc');
  expect(copyKitText(kit)).toContain(kit.brief.text);
  const pending = { ...kit, brief: { ...kit.brief, status: 'pending' as const } };
  expect(copyKitText(pending)).not.toContain(kit.brief.text);
  expect(JSON.parse(exportKitText(pending, 'json')).description).toBeNull();
});
