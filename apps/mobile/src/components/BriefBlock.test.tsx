import { render } from '@testing-library/react-native';
import { BriefBlock } from './BriefBlock';
import { kitFixture } from '../../tests/fixtures';

test('photo notes keep their card while waiting, failing, and receiving words', async () => {
  const view = await render(<BriefBlock brief={{ ...kitFixture.brief, status: 'pending', text: null }} showBaku={false} />);
  const card = view.getByTestId('photo-notes');
  expect(view.getByText('Photo notes')).toBeTruthy();
  expect(view.getByText('Your colors are ready. Baku is finding the words…')).toBeTruthy();
  await view.rerender(<BriefBlock brief={{ ...kitFixture.brief, status: 'failed', text: null }} showBaku={false} />);
  expect(view.getByTestId('photo-notes')).toBe(card);
  expect(view.getByText('Baku couldn’t find the words. Your colors are here.')).toBeTruthy();
  await view.rerender(<BriefBlock brief={kitFixture.brief} showBaku={false} />);
  expect(view.getByTestId('photo-notes')).toBe(card);
  expect(view.getByText(kitFixture.brief.text!)).toBeTruthy();
});
