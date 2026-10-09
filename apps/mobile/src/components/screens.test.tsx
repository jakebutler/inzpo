import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { InzpoApiError } from '@inzpo/shared';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoHaptics from 'expo-haptics';
import * as Reanimated from 'react-native-reanimated';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import { fonts, INK } from '@/theme/tokens';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import SignInScreen from '@/app/(auth)/sign-in';
import SnapScreen from '@/app/(app)/index';
import ResultScreen from '@/app/(app)/kit/[id]';
import KeepRoute from '@/app/(app)/keep/[id]';
import AuthLayout from '@/app/(auth)/_layout';
import AppLayout from '@/app/(app)/_layout';
import { completedResultKits } from '@/lib/useResultSequence';
import { useInzpoClient } from '@/lib/api';
import { createHaptics, haptics } from '@/lib/haptics';
import { uploadPhoto } from '@/lib/upload';
import { capturePhoto, handoffPhoto } from '@/lib/photo-handoff';
import { PrimaryArrow } from './PrimaryArrow';
import { photoPins } from '@/lib/result-pins';
import { resultSequenceBeats, SHUTTER_PRESS_SCALE, TAP_TIMING, BUTTON_PRESS_SCALE } from '@/theme/motion';
import { kitFixture, mockClient } from '../../tests/fixtures';
import { mockReanimatedMotion } from '../../tests/reanimated-motion';
import { restingBakuSize } from '@/theme/sign-in';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));
jest.mock('@/lib/upload', () => ({ uploadPhoto: jest.fn() }));
jest.mock('./PrimaryArrow', () => ({ PrimaryArrow: jest.fn(jest.requireActual('./PrimaryArrow').PrimaryArrow) }));

let client: ReturnType<typeof mockClient>;
const setActive = jest.fn();
const signIn = {
  status: 'needs_first_factor', createdSessionId: null as string | null,
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() }, reset: jest.fn(),
};

beforeEach(() => {
  completedResultKits.clear();
  handoffPhoto('other-kit', { uri: 'file:///other.jpg', width: 100, height: 100 });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'kit-1' });
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
  expect(view.getByText('Steal the colors off anything')).toBeTruthy();
  expect(view.getByText("Enter your email and we'll send you a code.")).toBeTruthy();
  expect(view.getByRole('button', { name: 'Send code' })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText('Email'), ' invited@example.com ');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  expect(signIn.emailCode.sendCode).toHaveBeenCalledWith({ emailAddress: 'invited@example.com' });
  expect(view.queryByText("Enter your email and we'll send you a code.")).toBeNull();
  expect(view.getByText('We sent a 6-digit code to invited@example.com.')).toBeTruthy();
  expect(view.queryByText(/Code sent to/)).toBeNull();
  expect(view.getByText('invited@example.com')).toHaveStyle({ fontFamily: fonts.bodyMedium, color: INK });
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '123');
  expect(view.getByRole('button', { name: 'Verify code' })).toBeDisabled();
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '424242');
  await fireEvent.press(view.getByRole('button', { name: 'Verify code' }));
  expect(signIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '424242' });
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

test.each(['camera', 'library'] as const)('%s shows the local photo before upload finishes and starts munching only after it paints', async (source) => {
  const photo = { uri: 'file:///snapped.jpg', width: 1500, height: 2000 };
  const picker = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  jest.mocked(picker).mockResolvedValue({ canceled: false, assets: [photo] });
  let resolveUpload!: (id: string) => void;
  jest.mocked(uploadPhoto).mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
  const view = await render(<SnapScreen />);
  await fireEvent.press(view.getByRole('button', { name: source === 'camera' ? 'Snap a house' : 'Pick from library' }));

  expect(uploadPhoto).toHaveBeenCalledWith(client, photo);
  expect(view.getByLabelText('House photo').props.source).toEqual({ uri: photo.uri });
  expect(router.push).not.toHaveBeenCalled();
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'loadEnd');
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('munch-player')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();

  await fireEvent(view.getByLabelText('House photo'), 'error');
  expect(view.queryByTestId('munch-player')).toBeNull();
  await act(async () => resolveUpload('kit-1'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/kit/[id]', params: { id: 'kit-1' } });
  expect(capturePhoto('kit-1')?.url).toBe(photo.uri);
  expect(view.queryByTestId('munch-player')).toBeNull();
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
  expect(view.queryByText('Chewing on it.')).toBeNull();
  expect(view.getByRole('button', { name: 'Snap a house' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Pick from library' })).toBeDisabled();
  await act(async () => { rejectUpload(new Error('offline')); });
  expect(view.getByText('Couldn’t keep this photo. Please try again.')).toBeTruthy();
  expect(view.getByTestId('baku-errorPhoto')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Snap a house' })).toBeEnabled();
});

test('result renders filled bands and preserves an empty accent without a swatch', async () => {
  const view = await render(<ResultScreen />);
  expect(await view.findByLabelText(kitFixture.title)).toBeTruthy();
  expect(view.getByText('#b35831')).toBeTruthy();
  expect(view.getByText('No accent in this one. Add a color.')).toBeTruthy();
  expect(view.getByTestId('role-empty-accent')).toHaveStyle({ backgroundColor: '#E4D9C6' });
  expect(view.queryByTestId('role-swatch-accent')).toBeNull();
  expect(view.getByText(kitFixture.brief.text!)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(client.getBrief).not.toHaveBeenCalled();
});

test('result actions sit outside the scroll content, film stays upright, and filled roles have fallback pins', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  expect(within(view.getByTestId('result-content')).queryByRole('button', { name: 'Save' })).toBeNull();
  expect(within(view.getByTestId('result-actions')).getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(view.getByTestId('film-print').props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ transform: expect.anything() })]));
  expect(view.getByRole('button', { name: 'Edit primary photo sample' })).toBeEnabled();
  expect(view.queryByTestId('photo-pin-accent')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Edit primary photo sample' }));
  expect(view.getByText('Pick a primary color')).toBeTruthy();
  expect(view.getByLabelText('Hex color').props.value).toBe(kitFixture.roles.primary);
});

test('chip detail keeps contrast behind a tap and offers the existing role editor', async () => {
  jest.useFakeTimers();
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  expect(view.queryByTestId('chip-detail-back')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'primary: #b35831. Show color detail.' }));
  await act(async () => jest.advanceTimersByTime(540));
  expect(view.getByTestId('chip-detail-back')).toBeTruthy();
  expect(view.getByText('From this spot.')).toBeTruthy();
  expect(view.queryByText(/\d+\.\d+:1/)).toBeNull();
  await fireEvent(view.getByTestId('chip-detail-toggle'), 'longPress');
  expect(view.queryByTestId('chip-detail-back')).toBeNull();
  expect(view.getByText('Pick a primary color')).toBeTruthy();
});

test('a pending brief polls and refetches the kit title after resolving', async () => {
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } })
    .mockResolvedValueOnce({ ...kitFixture, title: 'The brick house' });
  let resolveBrief!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((resolve) => { resolveBrief = resolve; }));
  const view = await render(<ResultScreen />);
  expect(view.queryByText('Chewing on it.')).toBeNull();
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('baku-chewing')).toBeTruthy();
  expect(view.getByTestId('result-hero')).toHaveStyle({ justifyContent: 'center' });
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Edit' })).toBeNull();
  await act(async () => { resolveBrief(kitFixture.brief); });
  expect(await view.findByLabelText('The brick house')).toBeTruthy();
  expect(client.getKit).toHaveBeenCalledTimes(2);
  expect(client.getBrief).toHaveBeenCalledWith('kit-1', expect.objectContaining({ signal: expect.anything() }));
});

test('waiting shows the delayed caption above fixed Result actions, then removes it when ready', async () => {
  jest.useFakeTimers();
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } })
    .mockResolvedValueOnce(kitFixture);
  let resolveBrief!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((resolve) => { resolveBrief = resolve; }));
  const view = await render(<ResultScreen />);
  await fireEvent(view.getByLabelText('House photo'), 'display');
  await act(async () => jest.advanceTimersByTime(1999));
  expect(view.queryByText('Chewing on it.')).toBeNull();
  await act(async () => jest.advanceTimersByTime(1));
  const actions = within(view.getByTestId('result-actions'));
  expect(view.getByTestId('munch-player')).toHaveStyle({ width: 280 });
  expect(actions.getByText('Chewing on it.')).toHaveStyle({ bottom: 64, position: 'absolute' });
  expect(within(view.getByTestId('result-content')).queryByText('Chewing on it.')).toBeNull();
  expect(actions.queryByRole('button', { name: 'Save' })).toBeNull();
  await act(async () => { resolveBrief(kitFixture.brief); });
  expect(view.queryByText('Chewing on it.')).toBeNull();
  expect(view.queryByTestId('munch-player')).toBeNull();
});

test('brief errors preserve the colors and render brief-error Baku', async () => {
  client.getKit.mockResolvedValue({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } });
  client.getBrief.mockRejectedValue(new Error('offline'));
  const view = await render(<ResultScreen />);
  expect(await view.findByText('Baku couldn’t finish the brief. Your colors are here.')).toBeTruthy();
  expect(view.getByTestId('baku-errorBrief')).toBeTruthy();
  expect(view.getByText('No accent in this one. Add a color.')).toBeTruthy();
});

test('Save is hidden until a kit has loaded', async () => {
  let resolveKit!: (kit: typeof kitFixture) => void;
  client.getKit.mockReturnValue(new Promise((resolve) => { resolveKit = resolve; }));
  const view = await render(<ResultScreen />);
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  await act(async () => { resolveKit(kitFixture); });
  await waitFor(() => expect(view.getByRole('button', { name: 'Save' })).toBeEnabled());
});

test('missing kit renders the 404 placeholder and retry', async () => {
  client.getKit.mockRejectedValue(new InzpoApiError(404, 'not found'));
  const view = await render(<ResultScreen />);
  expect(await view.findByText('This kit couldn’t be found.')).toBeTruthy();
  expect(view.getByTestId('baku-notFound')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('opening Save navigates to the full-screen Keep route', async () => {
  const view = await render(<ResultScreen />);
  await view.findByLabelText(kitFixture.title);
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/keep/[id]', params: { id: 'kit-1' } });
  await view.rerender(<KeepRoute />);
  expect(await view.findByText('Keep this kit')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  expect(await view.findByText('Neighborhood')).toBeTruthy();
});

test('ready data waits for the sequence before enabling both result actions', async () => {
  jest.useFakeTimers();
  const view = await render(<ResultScreen />);
  expect(view.getByLabelText(kitFixture.title)).toBeTruthy();
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
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Edit' })).toBeNull();
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
  await view.findByLabelText(kitFixture.title);
  await fireEvent(view.getByTestId('result-content'), 'scrollBeginDrag');
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  expect(view.getByTestId('edit-role-accent')).toHaveStyle({ backgroundColor: '#F3EEE4', borderStyle: 'dashed' });
  expect(view.queryByText('Color picking comes next')).toBeNull();
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
});

test('an empty Accent opens its picker and can be filled without changing other roles', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  expect(view.queryByTestId('role-swatch-accent')).toBeNull();
  expect(view.queryByTestId('photo-pin-accent')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'accent: No accent in this one. Add a color.' }));
  expect(view.getByText('Pick a accent color')).toBeTruthy();
  expect(view.getByLabelText('Hex color').props.value).toBe('');
  await fireEvent.changeText(view.getByLabelText('Hex color'), '#426092');
  await fireEvent.press(view.getByRole('button', { name: 'Save colors' }));
  expect(client.updateKitColors).toHaveBeenCalledWith('kit-1', { roles: { accent: '#426092' } });
  expect(view.getByTestId('role-swatch-accent')).toHaveStyle({ backgroundColor: '#426092' });
  expect(view.getByTestId('role-swatch-primary')).toHaveStyle({ backgroundColor: '#b35831' });
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

test.each([false, true])('Save success reaches the Result Baku, with exactly one Success haptic (reduced: %s)', async (reduced) => {
  jest.useFakeTimers(); mockReanimatedMotion();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(reduced);
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/keep/[id]', params: { id: 'kit-1' } });
  await view.rerender(<KeepRoute />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), 'Walks');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.queryByTestId('result-baku')).toBeNull();
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.getByTestId('save-check')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
  await act(async () => { jest.advanceTimersByTime(900); });
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/kit/[id]', params: { id: 'kit-1', saved: '1', c: 'collection-1' } });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'kit-1', saved: '1', c: 'collection-1' });
  await view.rerender(<ResultScreen />);
  await act(async () => { jest.advanceTimersByTime(80); });
  if (reduced) {
    expect(Reanimated.withTiming).not.toHaveBeenCalledWith(-14, expect.anything(), expect.anything());
    expect(Reanimated.withTiming).not.toHaveBeenCalledWith(0.92, expect.anything(), expect.anything());
    expect(Reanimated.withSpring).not.toHaveBeenCalled();
    expect(Reanimated.withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 150, reduceMotion: Reanimated.ReduceMotion.Never }));
    expect(view.getByTestId('baku-contact-shadow')).toHaveStyle({ transform: [{ scaleX: 1 }, { scaleY: 1 }] });
  } else {
    expect(Reanimated.withTiming).toHaveBeenCalledWith(-14, expect.objectContaining({ duration: 120 }), expect.any(Function));
  }
  await act(async () => { jest.advanceTimersByTime(1919); });
  expect(within(view.getByTestId('result-baku')).getByTestId('baku-success')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(within(view.getByTestId('result-baku')).getByTestId('baku-success')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await view.unmount();
});

test('Save failure stays on Keep with one Error haptic and no Baku', async () => {
  jest.useFakeTimers(); mockReanimatedMotion(); completedResultKits.add('kit-1');
  client.saveKit.mockRejectedValue(new Error('offline'));
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/keep/[id]', params: { id: 'kit-1' } });
  await view.rerender(<KeepRoute />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), 'Walks');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.queryByTestId('result-baku')).toBeNull();
  expect(view.getByText('Couldn’t save this kit. Please try again.')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Error);
  expect(Reanimated.withTiming).not.toHaveBeenCalledWith(-14, expect.anything(), expect.anything());
  expect(Reanimated.withSpring).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Not now' }));
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(view.queryByTestId('result-baku')).toBeNull();
  expect(router.back).toHaveBeenCalled();
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  await view.unmount();
});


test('choosing an Edit role and swatch saves the changed role and updates the result', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  await fireEvent.press(view.getByTestId('edit-role-accent'));
  expect(view.getByText('Pick a accent color')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save colors' })).toBeDisabled();
  await fireEvent.press(view.getByRole('button', { name: 'Color #B35831' }));
  expect(view.getByTestId('edit-role-accent')).toHaveStyle({ backgroundColor: '#b35831' });
  await fireEvent.press(view.getByRole('button', { name: 'Save colors' }));
  expect(client.updateKitColors).toHaveBeenCalledWith('kit-1', { roles: { accent: '#b35831' } });
  expect(view.getByTestId('role-swatch-accent')).toHaveStyle({ backgroundColor: '#b35831' });
  expect(view.queryByText('No accent in this one. Add a color.')).toBeNull();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
  expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
});

test('Edit rejects invalid hex and accepts six digits without a hash', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  await fireEvent.press(view.getByTestId('edit-role-primary'));
  await fireEvent.changeText(view.getByLabelText('Hex color'), '123');
  expect(view.getByText('Enter 6 hex digits.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save colors' })).toBeDisabled();
  await fireEvent(view.getByLabelText('Hex color'), 'submitEditing');
  expect(client.updateKitColors).not.toHaveBeenCalled();
  await fireEvent.changeText(view.getByLabelText('Hex color'), '12AB34');
  await fireEvent.press(view.getByRole('button', { name: 'Save colors' }));
  expect(client.updateKitColors).toHaveBeenCalledWith('kit-1', { roles: { primary: '#12ab34' } });
});

test('Edit failure keeps the draft and displays one error haptic', async () => {
  completedResultKits.add('kit-1');
  client.updateKitColors.mockRejectedValue(new Error('offline'));
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  await fireEvent.press(view.getByTestId('edit-role-primary'));
  await fireEvent.press(view.getByRole('button', { name: 'Clear' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save colors' }));
  expect(client.updateKitColors).toHaveBeenCalledWith('kit-1', { roles: { primary: null } });
  expect(view.getByText('Couldn’t save these colors. Please try again.')).toBeTruthy();
  expect(view.getByTestId('edit-role-primary')).toHaveStyle({ backgroundColor: '#F3EEE4' });
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Error);
});

test('saving enters the saved state, sets the title, and offers the collection and Snap actions', async () => {
  jest.useFakeTimers();
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/keep/[id]', params: { id: 'kit-1' } });
  await view.rerender(<KeepRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  await act(async () => { jest.advanceTimersByTime(900); });
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/kit/[id]', params: { id: 'kit-1', saved: '1', c: 'collection-1' } });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'kit-1', saved: '1', c: 'collection-1' });
  await view.rerender(<ResultScreen />);
  expect(view.getByLabelText('Saved to Neighborhood')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(Stack.Screen).toHaveBeenLastCalledWith(expect.objectContaining({ options: expect.objectContaining({ title: kitFixture.title, headerShown: false }) }), undefined);
  await fireEvent.press(view.getByRole('button', { name: 'Snap another' }));
  expect(router.dismissTo).toHaveBeenCalledWith('/');
  await view.rerender(<ResultScreen />);
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('a kit with collectionIds loads directly into its saved state', async () => {
  client.getKit.mockResolvedValue({ ...kitFixture, collectionIds: ['collection-1'] });
  const view = await render(<ResultScreen />);
  expect(await view.findByLabelText('Saved to Neighborhood')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(view.getByRole('button', { name: 'Edit' })).toBeTruthy();
  expect(Stack.Screen).toHaveBeenLastCalledWith(expect.objectContaining({ options: expect.objectContaining({ title: kitFixture.title, headerShown: false }) }), undefined);
});

test('saved kit collection lookup failure uses the fallback name', async () => {
  client.getKit.mockResolvedValue({ ...kitFixture, collectionIds: ['missing'] });
  client.listCollections.mockRejectedValue(new Error('offline'));
  const view = await render(<ResultScreen />);
  expect(await view.findByLabelText('Saved to your collection')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('Keep replaces Result with one header and no Baku, then Back restores Result', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Save' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/keep/[id]', params: { id: 'kit-1' } });
  await view.rerender(<KeepRoute />);
  expect(view.getAllByText('Keep this kit')).toHaveLength(1);
  expect(view.queryByText('Your colors')).toBeNull();
  expect(view.queryByTestId('result-actions')).toBeNull();
  expect(view.queryByTestId('result-baku')).toBeNull();
  expect(view.getByLabelText('Kit name').props.value).toBe(kitFixture.title);
  expect(view.getByRole('button', { name: 'Save kit' })).toBeEnabled();
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  expect(router.back).toHaveBeenCalled();
  await view.rerender(<ResultScreen />);
  expect(view.getByText('Your colors')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  expect(view.getByTestId('edit-role-primary')).toBeTruthy();
});

test('resend reuses the existing sign-in, disables while busy, and announces success temporarily', async () => {
  jest.useFakeTimers();
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByLabelText('Email'), 'invited@example.com');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  let resolve!: (result: { error: null }) => void;
  signIn.emailCode.sendCode.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const link = view.getByRole('link', { name: 'Didn’t get it? Send a new code.' });
  await fireEvent.press(link);
  expect(signIn.emailCode.sendCode).toHaveBeenCalledTimes(2);
  expect(signIn.emailCode.sendCode).toHaveBeenLastCalledWith();
  expect(link).toBeDisabled();
  expect(link).toHaveStyle({ minHeight: 44 });
  await act(async () => resolve({ error: null }));
  expect(view.getByText('New code sent.').props.accessibilityLiveRegion).toBe('polite');
  expect(view.queryByRole('link')).toBeNull();
  await act(async () => jest.advanceTimersByTime(4000));
  expect(view.getByRole('link')).toBeEnabled();
});

test('resend failure uses the existing auth error copy and restores the link', async () => {
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByLabelText('Email'), 'invited@example.com');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  signIn.emailCode.sendCode.mockResolvedValueOnce({ error: { code: 'too_many_requests' } });
  await fireEvent.press(view.getByRole('link'));
  expect(view.getByText("Couldn't sign in. Please try again.")).toBeTruthy();
  expect(view.queryByText('New code sent.')).toBeNull();
  expect(view.getByRole('link')).toBeEnabled();
});

test('code input strips non-digits and limits to six digits', async () => {
  const view = await render(<SignInScreen />);
  await fireEvent.changeText(view.getByLabelText('Email'), 'invited@example.com');
  await fireEvent.press(view.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(view.getByLabelText('6-digit code'), '42x424299');
  expect(view.getByLabelText('6-digit code').props.value).toBe('424242');
  expect(view.getByLabelText('6-digit code').props.maxLength).toBe(6);
});

test.each([
  { reduced: false, platform: 'ios' }, { reduced: true, platform: 'ios' },
  { reduced: false, platform: 'android' }, { reduced: true, platform: 'android' },
])('Baku responds to keyboard show/hide on $platform with reduced motion=$reduced', async ({ reduced, platform }) => {
  jest.replaceProperty(Platform, 'OS', platform as typeof Platform.OS);
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(reduced);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const listeners: Record<string, () => void> = {};
  const remove = jest.fn();
  const subscriptions = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    listeners[event] = callback as () => void;
    return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
  });
  const view = await render(<SignInScreen />);
  await act(async () => (listeners.keyboardWillShow ?? listeners.keyboardDidShow)());
  expect(timing).toHaveBeenCalledWith(96, { duration: reduced ? 0 : 220 });
  await act(async () => (listeners.keyboardWillHide ?? listeners.keyboardDidHide)());
  const dimensions = jest.requireActual<typeof import('react-native')>('react-native').Dimensions.get('window');
  expect(timing).toHaveBeenLastCalledWith(restingBakuSize(dimensions.width), { duration: reduced ? 0 : 220 });
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(subscriptions.mock.calls.length);
});


test('long kit names wrap in Akaya while description and controls retain their intended fonts', async () => {
  const title = 'The little house with the very tall windows and a long garden wall';
  client.getKit.mockResolvedValue({ ...kitFixture, title, collectionIds: ['collection-1'] });
  const view = await render(<ResultScreen />);
  const heading = await view.findByText(title);
  expect(heading).toHaveStyle({ fontFamily: fonts.heading, fontSize: 31, lineHeight: 31 });
  expect(heading.props.numberOfLines).toBeUndefined();
  expect(heading.props.maxFontSizeMultiplier).toBeUndefined();
  expect(heading.props.allowFontScaling).not.toBe(false);
  expect(view.getByText('The brief')).toHaveStyle({ fontFamily: fonts.heading, lineHeight: 30 });
  expect(view.getByText(kitFixture.brief.text!)).toHaveStyle({ fontFamily: fonts.body });
  expect(view.getByRole('button', { name: 'Snap another' })).toBeTruthy();
});

test.each([false, true])('only one chip expands, replaces another, and returns to the table (reduced: %s)', async (reduced) => {
  jest.useFakeTimers();
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(reduced);
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  await fireEvent.press(view.getByTestId('flip-chip-primary'));
  expect(view.getByTestId('flip-chip-primary').props.accessibilityState.expanded).toBe(true);
  expect(view.getByTestId('flip-chip-secondary').props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(view.getByTestId('flip-chip-secondary'));
  expect(view.getByTestId('flip-chip-primary').props.accessibilityState.expanded).toBe(false);
  expect(view.getByTestId('flip-chip-secondary').props.accessibilityState.expanded).toBe(true);
  expect(view.getAllByTestId('chip-detail-layer')).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(reduced ? 150 : 540));
  await fireEvent.press(view.getByTestId('chip-detail-toggle'));
  await act(async () => jest.advanceTimersByTime(reduced ? 150 : 540));
  expect(view.getByTestId('flip-chip-secondary').props.accessibilityState.expanded).toBe(false);
  expect(view.queryByTestId('chip-detail-layer')).toBeNull();
  expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  await view.unmount();
});

test('saved actions have enamel/paper materials, navigate to the chosen collection and keep Snap on the root', async () => {
  completedResultKits.add('kit-1');
  client.getKit.mockResolvedValue({ ...kitFixture, collectionIds: ['collection-1'] });
  const view = await render(<ResultScreen />);
  await view.findByText('Saved to your collection.');
  expect(view.getByTestId('saved-composition')).toHaveStyle({ transform: [{ rotate: '-1.75deg' }] });
  expect(view.getByTestId('closed-kit-deck')).toBeTruthy();
  expect(view.queryByTestId('chip-pile')).toBeNull();
  expect(view.queryByTestId('photo-pins')).toBeNull();
  const collection = view.getByRole('button', { name: 'See your collection' });
  const snap = view.getByRole('button', { name: 'Snap another' });
  expect(collection).toHaveStyle({ backgroundColor: '#426092', borderRadius: 24, minHeight: 48 });
  expect(snap).toHaveStyle({ backgroundColor: '#F7F1E6', borderRadius: 5, minHeight: 48 });
  await fireEvent.press(collection);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/collection/[id]', params: { id: 'collection-1' } });
  await fireEvent.press(snap);
  expect(router.dismissTo).toHaveBeenCalledWith('/');
  await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
  expect(view.getByTestId('edit-role-primary')).toBeTruthy();
});

test('saved deck retains the editing guard while its brief is pending', async () => {
  client.getKit.mockResolvedValue({ ...kitFixture, collectionIds: ['collection-1'],
    brief: { ...kitFixture.brief, status: 'pending', text: null } });
  client.getBrief.mockReturnValue(new Promise(() => {}));
  const view = await render(<ResultScreen />);
  expect(view.queryByText('Chewing on it.')).toBeNull();
  expect(view.getByRole('button', { name: 'Edit' })).toBeDisabled();
});


test('Keep edits the kit name independently of the collection name', async () => {
  const view = await render(<KeepRoute />);
  expect(view.getByLabelText('Kit name').props.value).toBe(kitFixture.title);
  expect(view.getByText("Name it the way you'd write it on the back of a photo.")).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('Kit name'), 'Orange Victorian');
  await fireEvent.changeText(view.getByLabelText('New collection name'), 'Walks');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { title: 'Orange Victorian', newName: 'Walks' });
});

test('Keep can save the renamed kit to an existing collection', async () => {
  const view = await render(<KeepRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Neighborhood, 2 kits' }));
  await fireEvent.changeText(view.getByLabelText('Kit name'), 'Orange House');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { title: 'Orange House', collectionId: 'collection-1' });
});

test('each filled role has a photo pin and an empty role has only its label and body', async () => {
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  for (const role of ['primary', 'secondary', 'background', 'surface', 'text']) expect(view.getByTestId(`photo-pin-${role}`)).toBeTruthy();
  expect(view.queryByTestId('photo-pin-accent')).toBeNull();
  expect(view.getByText('ACCENT')).toBeTruthy();
  expect(view.getByText('No accent in this one. Add a color.')).toBeTruthy();
  expect(view.queryByText(/No color yet/)).toBeNull();
});

test('Your colors renders exactly four photo pins for four filled roles, even when their samples coincide', async () => {
  const roles = { ...kitFixture.roles, surface: null };
  const filledRoles = (['primary', 'secondary', 'background', 'text'] as const);
  const kit = { ...kitFixture, roles, colors: filledRoles.map((role) => ({
    role, hex: roles[role]!, name: null, origin: 'sampled', pinX: 0.5, pinY: 0.95,
  })) };
  client.getKit.mockResolvedValue(kit);
  completedResultKits.add('kit-1');
  const view = await render(<ResultScreen />);
  expect(view.getAllByTestId(/^photo-pin-/)).toHaveLength(Object.values(roles).filter(Boolean).length);
  for (const role of filledRoles) expect(view.getByTestId(`photo-pin-${role}`)).toBeTruthy();
  expect(view.queryByTestId('photo-pin-accent')).toBeNull();
  expect(view.queryByTestId('photo-pin-surface')).toBeNull();
});


test('the capture photo is present during the initial kit request and chew waits for display', async () => {
  handoffPhoto('kit-1', { uri: 'file:///picked.jpg', width: 1500, height: 2000 });
  client.getKit.mockReturnValue(new Promise(() => {}));
  const view = await render(<ResultScreen />);
  expect(view.getByLabelText('House photo').props.source).toEqual({ uri: 'file:///picked.jpg' });
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('munch-player')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'error');
  expect(view.queryByTestId('munch-player')).toBeNull();
});

test('a painted capture does not start munching on the result image until that new source paints', async () => {
  handoffPhoto('kit-1', { uri: 'file:///picked.jpg', width: 1500, height: 2000 });
  let resolveKit!: (kit: typeof kitFixture) => void;
  client.getKit.mockReturnValue(new Promise((resolve) => { resolveKit = resolve; }));
  client.getBrief.mockReturnValue(new Promise(() => {}));
  const view = await render(<ResultScreen />);
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('munch-player')).toBeTruthy();

  await act(async () => resolveKit({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } }));
  expect(view.getByLabelText('House photo').props.source).toEqual({ uri: kitFixture.photo!.url });
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('munch-player')).toBeTruthy();

  await fireEvent(view.getByLabelText('House photo'), 'error');
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Reload photo' }));
  expect(view.queryByTestId('munch-player')).toBeNull();
  await fireEvent(view.getByLabelText('House photo'), 'display');
  expect(view.getByTestId('munch-player')).toBeTruthy();
});

test.each([null, kitFixture.photo])('without a displayed photo chewing never plays (%s)', async (photo) => {
  client.getKit.mockResolvedValue({ ...kitFixture, photo, brief: { ...kitFixture.brief, status: 'pending', text: null } });
  client.getBrief.mockReturnValue(new Promise(() => {}));
  const view = await render(<ResultScreen />);
  expect(view.queryByTestId('munch-player')).toBeNull();
});

test('the signature ends on Primary even when a window pin comes first in the color array', async () => {
  const kit = { ...kitFixture, photo: { ...kitFixture.photo!, width: 1500, height: 2000 }, colors: [
    { role: 'secondary' as const, hex: kitFixture.roles.secondary!, origin: 'sampled', name: 'window', pinX: 0.7, pinY: 0.3 },
    { role: 'primary' as const, hex: kitFixture.roles.primary!, origin: 'sampled', name: 'siding', pinX: 307 / 1500, pinY: 889 / 2000 },
  ] };
  client.getKit.mockResolvedValue(kit);
  const view = await render(<ResultScreen />);
  const print = view.getByTestId('film-print');
  const { width, height } = StyleSheet.flatten(print.props.style);
  const primary = photoPins(kit, width - 26, height - 50).find((pin) => pin.role === 'primary')!;
  const arrow = jest.mocked(PrimaryArrow).mock.calls.at(-1)![0];
  expect(arrow.end.x).toBeCloseTo((arrow.width - width) / 2 + 13 + primary.marker.x);
  expect(arrow.end.y).toBeCloseTo(13 + primary.marker.y);
});
