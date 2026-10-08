import { BottomSheetModal, type BottomSheetModalProps } from '@gorhom/bottom-sheet';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { createRef, type ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useInzpoClient } from '@/lib/api';
import { createHaptics, haptics } from '@/lib/haptics';
import { kitFixture, mockClient } from '../../tests/fixtures';
import { EditSheet, type EditSheetHandle } from './EditSheet';
import { EditBackdrop, SaveBackdrop } from './MotionSheet';
import { SaveSheet } from './SaveSheet';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));

// Observe the props/methods of the installed official mock, preserving its
// real mock render rather than substituting a homegrown sheet implementation.
type ModalInstance = {
  props: BottomSheetModalProps;
  render: () => ReactNode;
  present: () => void;
  dismiss: () => void;
  snapToIndex: (index: number) => void;
};
const MockModal = BottomSheetModal as unknown as { prototype: ModalInstance };
let sheetProps: BottomSheetModalProps;
beforeEach(() => {
  jest.mocked(useInzpoClient).mockReturnValue(mockClient());
  jest.mocked(useReducedMotion).mockReturnValue(false);
  Object.assign(haptics, createHaptics());
  const originalRender = MockModal.prototype.render;
  jest.spyOn(MockModal.prototype, 'render').mockImplementation(function (this: ModalInstance) {
    sheetProps = this.props;
    return originalRender.call(this);
  });
});
afterEach(() => jest.restoreAllMocks());

test.each([false, true])('Save modal sizes to content, handles the keyboard, and uses the shared spring (reduced: %s)', async (reduced) => {
  jest.mocked(useReducedMotion).mockReturnValue(reduced);
  const present = jest.spyOn(MockModal.prototype, 'present');
  const dismiss = jest.spyOn(MockModal.prototype, 'dismiss');
  const onClose = jest.fn();
  const view = await render(<SaveSheet visible={false} kitId="kit-1" onClose={onClose} />);
  expect(view.queryByText('Keep this kit')).toBeNull();
  await view.rerender(<SaveSheet visible kitId="kit-1" onClose={onClose} />);
  expect(present).toHaveBeenCalledTimes(1);
  expect(sheetProps).toMatchObject({
    enableDynamicSizing: true, maxDynamicContentSize: Dimensions.get('window').height * 0.6,
    keyboardBehavior: 'interactive', keyboardBlurBehavior: 'restore', android_keyboardInputMode: 'adjustResize',
    enablePanDownToClose: true,
    animationConfigs: { damping: reduced ? 40 : 30, stiffness: reduced ? 400 : 300 },
    backgroundStyle: { backgroundColor: '#F3EEE4', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    handleIndicatorStyle: { width: 36, height: 4 },
  });
  expect(view.getByLabelText('New collection name').props.autoFocus).toBe(true);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  dismiss.mockClear();
  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
  await act(async () => sheetProps.onDismiss?.());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Edit peeks with six chips, expands to the placeholder, and exposes snapToPeek', async () => {
  const ref = createRef<EditSheetHandle>();
  const snap = jest.spyOn(MockModal.prototype, 'snapToIndex');
  const view = await render(<EditSheet ref={ref} visible roles={kitFixture.roles} onClose={jest.fn()} />);
  expect(sheetProps).toMatchObject({ snapPoints: [156, '64%'], index: 0, enableDynamicSizing: false, enablePanDownToClose: true });
  expect(view.getByTestId('edit-role-primary')).toHaveStyle({ backgroundColor: '#b35831' });
  expect(view.getByTestId('edit-role-accent')).toHaveStyle({ backgroundColor: '#F3EEE4', borderStyle: 'dashed' });
  expect(view.queryByText('Color picking comes next')).toBeNull();
  await act(async () => sheetProps.onChange?.(1, 300, 0));
  expect(view.getByText('Color picking comes next')).toBeTruthy();
  await act(async () => ref.current?.snapToPeek());
  expect(snap).toHaveBeenCalledWith(0);
  await act(async () => sheetProps.onChange?.(0, 156, 0));
  expect(view.queryByText('Color picking comes next')).toBeNull();
});

test('Save and Edit backdrops dim at their highest snap only', async () => {
  const { result } = await renderHook(() => ({ animatedIndex: useSharedValue(0), animatedPosition: useSharedValue(0) }));
  expect(SaveBackdrop(result.current).props).toMatchObject({ opacity: 0.35, appearsOnIndex: 0, disappearsOnIndex: -1 });
  expect(EditBackdrop(result.current).props).toMatchObject({ opacity: 0.35, appearsOnIndex: 1, disappearsOnIndex: 0 });
});
