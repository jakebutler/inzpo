import { fireEvent, render } from '@testing-library/react-native';
import { ActionButton } from './ActionButton';
import { SaveButton } from './SaveButton';
import { buttonSurface } from '@/theme/buttons';
import { fonts } from '@/theme/tokens';
import * as Reanimated from 'react-native-reanimated';

function surface(primary: boolean, pressed: boolean, disabled: boolean) {
  const { transform: _, ...material } = buttonSurface(primary, pressed, disabled);
  return material;
}

test.each([false, true])('buttons share the raised and pressed surfaces (primary=%s)', async (primary) => {
  const view = await render(<ActionButton label="Continue" primary={primary} onPress={jest.fn()} />);
  const button = view.getByRole('button');
  expect(button).toHaveStyle({ borderWidth: 1, ...surface(primary, false, false) });
  expect(view.getByText('Continue')).toHaveStyle({ fontFamily: fonts.bodyMedium });
  await fireEvent(button, 'pressIn');
  expect(button).toHaveStyle(surface(primary, true, false));
  expect(button).toHaveStyle({ transform: [{ translateY: 2 }, { scale: primary ? 1 : 0.96 }] });
  await fireEvent(button, 'pressOut');
  expect(button).toHaveStyle(surface(primary, false, false));
  await view.rerender(<ActionButton label="Continue" primary={primary} disabled onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle({ opacity: 0.4, boxShadow: [] });
});

test('Save uses the same surface and remains at 40% opacity while disabled', async () => {
  const view = await render(<SaveButton saved={false} saving={false} disabled={false} onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle(surface(true, false, false));
  await view.rerender(<SaveButton saved saving={false} disabled={false} onPress={jest.fn()} />);
  expect(view.getByRole('button')).toHaveStyle({ opacity: 0.4, boxShadow: [] });
});

test('reduced motion Save fades on press without sinking or scaling', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const view = await render(<ActionButton label="Save" primary onPress={jest.fn()} />);
  await fireEvent(view.getByRole('button'), 'pressIn');
  expect(view.getByRole('button')).toHaveStyle({ transform: [{ translateY: 0 }, { scale: 1 }], opacity: 0.72, backgroundColor: '#3D5988' });
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
});
