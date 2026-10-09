// Set EXPO_PUBLIC_APP_VARIANT=preview in the preview build/update environment.
// Production deep links are gated too; EAS_BUILD_PROFILE is build-time only.
export const munchLabEnabled = __DEV__ || process.env.EXPO_PUBLIC_APP_VARIANT === 'preview';
