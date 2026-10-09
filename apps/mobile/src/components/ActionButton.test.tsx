import { fireEvent, render } from '@testing-library/react-native';
import { ActionButton } from './ActionButton';
import { SaveButton } from './SaveButton';
import { buttonSurface } from '@/theme/buttons';
import { fonts } from '@/theme/tokens';

test.each([false, true])('buttons share the raised and pressed surfaces (primary=%s)', async (primary) => {
  const view = await render(<ActionButton label="Continue" primary={primary} onPress={jest.fn()} />);
  const button = view.getByRole('button');
  expect(button).toHaveStyle({ borderWidth: 1, ...buttonSurface(primary, false, false) });
  expect(view.getByText('Continue')).toHaveStyle({ fontFamily: fonts.bodyMedium });
  await fireEvent(button, 'pressIn');
  expect(button).toHaveStyle(buttonSurface(primary, true, false));
  await fireEvent(button, 'pressOut');
  expect(button).toHaveStyle(buttonSurface(primary, false, false));
  await view.rerender(<ActionButton label="Continue" primary={primary} disabled onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle({ opacity: 0.4, boxShadow: [] });
});

test('Save uses the same surface and remains at 40% opacity while disabled', async () => {
  const view = await render(<SaveButton saved={false} saving={false} disabled={false} onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle(buttonSurface(true, false, false));
  await view.rerender(<SaveButton saved saving={false} disabled={false} onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle({ opacity: 0.4, boxShadow: [] });
});
