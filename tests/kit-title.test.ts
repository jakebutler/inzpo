import { readFile } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import { extractPalette } from '@/lib/palette-extract';
import { FOLD_BRIEFS } from '@/lib/fold-briefs';

const mocks = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: mocks }));
import { persistKitTitleFromBrief } from '@/lib/kit-title';
import { requestBriefCompletion } from '@/lib/brief-request';
import { BRIEF_PROMPT } from '@/lib/brief-prompt';

let title: string | null;
let primary: string;
beforeEach(() => {
  title = null;
  primary = '#d6d3af';
  vi.clearAllMocks();
  mocks.select.mockImplementation((columns) => ({ from: () => ({ where: () => ({
    limit: async () => 'title' in columns ? [{ title }] : [{ hex: primary, role: 'primary', origin: 'region', pinX: .3, pinY: .4 }],
  }) }) }));
  mocks.update.mockImplementation(() => ({ set: (values: { title: string }) => ({ where: () => ({
    returning: async () => { title = values.title; return [{ title }]; },
  }) }) }));
});
const brief = { status: 'ready', stub: false, text: 'A white Victorian with a black door.',
  namedColors: [{ hex: '#ffffff', label: 'white windows' }] };

it('names IMG_6505 once from extracted Primary and the brief subject, then keeps the saved name', async () => {
  primary = (await extractPalette(await readFile('public/sample/IMG_6505.jpg'))).roles.primary!;
  expect(await persistKitTitleFromBrief('IMG_6505', { ...brief, text: FOLD_BRIEFS.IMG_6505.text })).toBe('Yellow Victorian');
  expect(title).toBe('Yellow Victorian');
  primary = '#426092';
  expect(await persistKitTitleFromBrief('IMG_6505', { ...brief, text: 'A blue house.' })).toBe('Yellow Victorian');
  expect(mocks.update).toHaveBeenCalledTimes(1);
});

it('gives repeated captures of the same image the style name with mocked generic subject responses', async () => {
  const imageUrl = `data:image/jpeg;base64,${(await readFile('public/sample/IMG_6505.jpg')).toString('base64')}`;
  primary = (await extractPalette(await readFile('public/sample/IMG_6505.jpg'))).roles.primary!;
  const bodies: unknown[] = [];
  for (const subject of ['House', 'Townhouse']) {
    // Each upload starts with a new unnamed item, even though the image is identical.
    title = null;
    const completion = await requestBriefCompletion({ imageUrl, keptHexes: [primary], apiKey: 'test-key',
      fetchImpl: (async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        bodies.push(body);
        expect(body.temperature).toBe(0);
        expect(body.messages[0]).toEqual({ role: 'system', content: BRIEF_PROMPT });
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
          subject, text: 'Yellow Victorian siding and white trim feel dignified.', namedColors: [],
        }) } }] }));
      }) as typeof fetch,
    });
    expect(await persistKitTitleFromBrief(`capture-${subject}`, { ...brief, ...completion, namedColors: [] })).toBe('Yellow Victorian');
    expect(title).toBe('Yellow Victorian');
    expect(await persistKitTitleFromBrief(`capture-${subject}`, { ...brief, subject: 'House', text: 'A house.' })).toBe('Yellow Victorian');
  }
  expect(bodies[0]).toEqual(bodies[1]);
  expect(mocks.update).toHaveBeenCalledTimes(2);
});

it('only uses the color kit fallback when the brief has no subject noun', async () => {
  expect(await persistKitTitleFromBrief('kit', { ...brief, text: 'Soft, buttery and sunlit.' })).toBe('Yellow kit');
});

it('uses a vision subject outside the brief vocabulary instead of a kit fallback', async () => {
  expect(await persistKitTitleFromBrief('kit', { ...brief, subject: 'Awning', text: 'Sunlit stripes, cheerful and warm.' })).toBe('Yellow Awning');
});

it('waits for subject analysis before naming and preserves explicit names', async () => {
  expect(await persistKitTitleFromBrief('kit', { ...brief, status: 'pending' })).toBeNull();
  expect(mocks.update).not.toHaveBeenCalled();
  title = 'Sunday walks';
  expect(await persistKitTitleFromBrief('kit', brief)).toBe('Sunday walks');
  expect(mocks.update).not.toHaveBeenCalled();
});

it('keeps a concurrent explicit rename rather than overwriting it with the generated name', async () => {
  mocks.update.mockImplementation(() => ({ set: () => ({ where: () => ({
    returning: async () => { title = 'Sunday walks'; return []; },
  }) }) }));
  expect(await persistKitTitleFromBrief('kit', brief)).toBe('Sunday walks');
});

it.each([{ ...brief, stub: true, text: null }, { ...brief, status: 'failed', text: null }])('persists a Primary fallback after subjectless completion: $status / $stub', async (job) => {
  expect(await persistKitTitleFromBrief('kit', job)).toBe('Yellow kit');
  expect(title).toBe('Yellow kit');
});

 it('names a palette with no Primary from its first real role, skipping old padding', async () => {
  mocks.select.mockImplementation((columns) => ({ from: () => ({ where: () => ({ limit: async () => 'title' in columns ? [{ title }] : [
    { hex: '#ff0000', role: 'primary', origin: 'extracted', pinX: .5, pinY: .5 },
    { hex: '#426092', role: 'secondary', origin: 'sampled', pinX: .2, pinY: .4 },
  ] }) }) }));
  expect(await persistKitTitleFromBrief('kit', { ...brief, subject: 'Bowl', text: 'Blue ceramic.' })).toBe('Blue Bowl');
});
