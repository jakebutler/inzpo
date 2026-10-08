import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { InzpoApiError } from '@inzpo/shared';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoHaptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';
import { router } from 'expo-router';
import SignInScreen from '@/app/(auth)/sign-in';
import SnapScreen from '@/app/(app)/index';
import ResultScreen from '@/app/(app)/kit/[id]';
import AuthLayout from '@/app/(auth)/_layout';
import AppLayout from '@/app/(app)/_layout';
import { completedResultKits } from '@/lib/useResultSequence';
import { useInzpoClient } from '@/lib/api';
import { createHaptics, haptics } from '@/lib/haptics';
import { uploadPhoto } from '@/lib/upload';
import { resultSequenceBeats, SHUTTER_PRESS_SCALE, TAP_TIMING, BUTTON_PRESS_SCALE } from '@/theme/motion';
import { kitFixture, mockClient } from '../../tests/fixtures';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));
jest.mock('@/lib/upload', () => ({ uploadPhoto: jest.fn() }));

let client: ReturnType<typeof mockClient>;
const setActive = jest.fn();
const signIn = {
  status: 'needs_first_factor', createdSessionId: null as string | null,
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() }, reset: jest.fn(),
};

beforeEach(() => {
  completedResultKits.clear();
  Object.assign(haptics, createHaptics());
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  client = mockClient();
  jest.mocked(useInzpoClient).mockReturnValue(client);
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: false } as ReturnType<typeof useAuth>);
  jest.mocked(useClerk).mockReturnValue({ setActive, signOut: jest.fn() } as unknown as ReturnType<typeof useClerk>);
  signIn.status = 'needs_first_factor';
  signIn.createdSessionId = null;
  signIn.emailCode.sendCode.mockResolvedValue({ error: null });
  signIn.emailCode.verifyCode.mockImplementation(async () => {
    signIn.status = 'complete'; signIn.createdSessionId = 'session-1';
    return { error: null };
  });
  signIn.reset.mockResolvedValue({ error: null });
  jest.mocked(useSignIn).mockReturnValue({ signIn } as unknown as ReturnType<typeof useSignIn>);
  setActive.mockResolvedValue(undefined);
  jest.mocked(uploadPhoto).mockResolvedValue('kit-1');
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.CameraPermissionResponse);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('sign-in renders, sends an email code, verifies six digits, and activates the session', async () => {
  const view = await render(<SignInScreen />);
  expect(view.getByText('Snap a house. Keep its colors.')).toBeTruthy();
  expect(view.getByText("Enter your email and we'll send you a code.")).toBeTruthy();
  expect(view.getByRole('button', { name: 'Send code' })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText('Email'), ' invited@example.com ');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  expect(signIn.emailCode.sendCode).toHaveBeenCalledWith({ emailAddress: 'invited@example.com' });
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '123');
  expect(view.getByRole('button', { name: 'Verify code' })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '123456');
  await fireEvent.press(view.getByRole('button', { name: 'Verify code' }));
  expect(signIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '123456' });
  expect(setActive).toHaveBeenCalledWith({ session: 'session-1' });
});

test.each(['form_identifier_not_found', 'restricted_access', 'form_identifier_not_allowed'])('maps %s to the invite-list copy', async (code) => {
  signIn.emailCode.sendCode.mockResolvedValue({ error: { errors: [{ code }] } });
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByLabelText('Email'), 'unknown@example.com');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  expect(view.getByText("That email isn't on the invite list yet.")).toBeTruthy();
});

test('a failed code verification offers retry and does not activate a session', async () => {
  signIn.emailCode.verifyCode.mockResolvedValueOnce({ error: { code: 'form_code_incorrect' } });
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByLabelText('Email'), 'invited@example.com');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '000000');
  await fireEvent.press(view.getByRole('button', { name: 'Verify code' }));
  expect(view.getByText("Couldn't sign in. Please try again.")).toBeTruthy();
  expect(setActive).not.toHaveBeenCalled();
});

test('auth layouts redirect signed-out app access and signed-in auth access', async () => {
  const app = await render(<AppLayout />);
  expect(app.getByText('redirect:/sign-in')).toBeTruthy();
  await app.unmount();
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: true } as ReturnType<typeof useAuth>);
  const auth = await render(<AuthLayout />);
  expect(auth.getByText('redirect:/')).toBeTruthy();
});

test('snap renders both actions and uploads a library image before navigating', async () => {
  const photo = { uri: 'file:///house.jpg', width: 4000, height: 3000 };
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [photo] });
  const view = await render(<SnapScreen />);
  expect(view.getByRole('button', { name: 'Snap a house' })).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Pick from library' }));
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'] }));
  expect(uploadPhoto).toHaveBeenCalledWith(client, photo);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/kit/[id]', params: { id: 'kit-1' } });
});

test('camera permission denial shows photo-error Baku without launching the camera', async () => {
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false } as ImagePicker.CameraPermissionResponse);
  const view = await render(<SnapScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Snap a house' }));
  expect(view.getByText('Allow camera access in Settings to snap a house.')).toBeTruthy();
  expect(view.getByTestId('baku-errorPhoto')).toBeTruthy();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test('canceling the picker neither uploads nor navigates', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  const view = await render(<SnapScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Pick from library' }));
  expect(uploadPhoto).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

test('upload pending disables both actions; failure restores them and shows one line of error copy', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///house.jpg', width: 2000, height: 1000 }] });
  let rejectUpload!: (reason: Error) => void;
  jest.mocked(uploadPhoto).mockReturnValue(new Promise((_resolve, reject) => { rejectUpload = reject; }));
  const view = await render(<SnapScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Pick from library' }));
  expect(view.getByText('Baku is chewing on it…')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Snap a house' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Pick from library' })).toBeDisabled();
  await act(async () => { rejectUpload(new Error('offline')); });
  expect(view.getByText('Couldn’t keep this photo. Please try again.')).toBeTruthy();
  expect(view.getByTestId('baku-errorPhoto')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Snap a house' })).toBeEnabled();
});

test('result renders filled bands and preserves an empty accent without a swatch', async () => {
  const view = await render(<ResultScreen />);
  expect(await view.findByText(kitFixture.title)).toBeTruthy();
  expect(view.getByText('#B35831')).toBeTruthy();
  expect(view.getByText('No accent in this one.')).toBeTruthy();
  expect(view.getByTestId('role-empty-accent')).toHaveStyle({ backgroundColor: '#F3EEE4', borderStyle: 'dashed' });
  expect(view.queryByTestId('role-swatch-accent')).toBeNull();
  expect(view.getByText(kitFixture.brief.text!)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(client.getBrief).not.toHaveBeenCalled();
});

test('a pending brief polls and refetches the kit title after resolving', async () => {
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } })
    .mockResolvedValueOnce({ ...kitFixture, title: 'The brick house' });
  let resolveBrief!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((resolve) => { resolveBrief = resolve; }));
  const view = await render(<ResultScreen />);
  expect(await view.findByText('Baku is chewing on it…')).toBeTruthy();
  expect(view.getByTestId('baku-chewing')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Save' })).toHaveStyle({ opacity: 0.4 });
  await act(async () => { resolveBrief(kitFixture.brief); });
  expect(await view.findByText('The brick house')).toBeTruthy();
  expect(client.getKit).toHaveBeenCalledTimes(2);
  expect(client.getBrief).toHaveBeenCalledWith('kit-1', expect.objectContaining({ signal: expect.anything() }));
});

test('brief errors preserve the colors and render brief-error Baku', async () => {
  client.getKit.mockResolvedValue({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } });
  client.getBrief.mockRejectedValue(new Error('offline'));
  const view = await render(<ResultScreen />);
  expect(await view.findByText('Baku couldn’t finish the brief. Your colors are here.')).toBeTruthy();
  expect(view.getByTestId('baku-errorBrief')).toBeTruthy();
  expect(view.getByText('No accent in this one.')).toBeTruthy();
});

test('Save stays disabled until a kit has loaded', async () => {
  let resolveKit!: (kit: typeof kitFixture) => void;
  client.getKit.mockReturnValue(new Promise((resolve) => { resolveKit = resolve; }));
  const view = await render(<ResultScreen />);
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  await act(async () => { resolveKit(kitFixture); });
  await waitFor(() => expect(view.getByRole('button', { name: 'Save' })).toBeEnabled());
});

test('missing kit renders the 404 placeholder and retry', async () => {
  client.getKit.mockRejectedValue(new InzpoApiError(404, 'not found'));
  const view = await render(<ResultScreen />);
  expect(await view.findByText('This kit couldn’t be found.')).toBeTruthy();
  expect(view.getByTestId('baku-notFound')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('opening Save presents the collection content in the result modal', async () => {
  const view = await render(<ResultScreen />);
  await view.findByText(kitFixture.title);
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(await view.findByText('Keep this kit')).toBeTruthy();
  expect(await view.findByText('Neighborhood')).toBeTruthy();
});

test('ready data waits for the sequence before enabling both result actions', async () => {
  jest.useFakeTimers();
  const view = await render(<ResultScreen />);
  expect(view.getByText(kitFixture.title)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeDisabled();
  const { interactiveMs } = resultSequenceBeats(6, false);
  await act(async () => { jest.advanceTimersByTime(interactiveMs - 1); });
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeEnabled();
});

test('scrolling without a touch event still skips the active result sequence', async () => {
  jest.useFakeTimers();
  const view = await render(<ResultScreen />);
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  await fireEvent.scroll(view.getByTestId('result-content'), { nativeEvent: { contentOffset: { x: 0, y: 24 } } });
  expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeEnabled();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
});

test('tapping during pending preserves the hero and keeps buttons gated until it finishes', async () => {
  jest.useFakeTimers();
  const pending = { ...kitFixture, brief: { ...kitFixture.brief, status: 'pending' as const, text: null } };
  client.getKit.mockResolvedValueOnce(pending).mockResolvedValueOnce(kitFixture);
  let resolveBrief!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((resolve) => { resolveBrief = resolve; }));
  const view = await render(<ResultScreen />);
  await fireEvent(view.getByTestId('result-content'), 'touchStart');
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeDisabled();
  await act(async () => { resolveBrief(kitFixture.brief); });
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeDisabled();
  await act(async () => { jest.advanceTimersByTime(resultSequenceBeats(6, false).interactiveMs); });
  expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(view.getByRole('button', { name: 'Edit' })).toBeEnabled();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Soft);
});

test('Edit opens at the peek and preserves the empty accent chip', async () => {
  const view = await render(<ResultScreen />);
  await view.findByText(kitFixture.title);
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  expect(view.getByTestId('edit-role-accent')).toHaveStyle({ backgroundColor: '#F3EEE4', borderStyle: 'dashed' });
  expect(view.queryByText('Color picking comes next')).toBeNull();
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
});

test.each([
  ['Snap a house', SHUTTER_PRESS_SCALE],
  ['Pick from library', BUTTON_PRESS_SCALE],
] as const)('%s scales and fires Light on press-in, with spring release and no release haptic', async (label, scale) => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const spring = jest.spyOn(Reanimated, 'withSpring');
  const view = await render(<SnapScreen />);
  const button = view.getByRole('button', { name: label });
  await fireEvent(button, 'pressIn');
  expect(timing).toHaveBeenCalledWith(scale, TAP_TIMING);
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Light);
  await fireEvent(button, 'pressOut');
  expect(spring).toHaveBeenCalledWith(1, expect.objectContaining({ damping: 18, stiffness: 220, mass: 1 }));
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

test('reduced motion Snap fades on press and keeps Light feedback', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const spring = jest.spyOn(Reanimated, 'withSpring');
  const view = await render(<SnapScreen />);
  await fireEvent(view.getByRole('button', { name: 'Snap a house' }), 'pressIn');
  expect(timing).toHaveBeenCalledWith(0.72, expect.objectContaining({ duration: 150 }));
  expect(spring).not.toHaveBeenCalled();
  expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Light);
});
