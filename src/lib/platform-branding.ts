export const DEFAULT_APP_NAME = "GenMeet";

export type PlatformBranding = {
  appName: string;
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  splashBackgroundUrl: string | null;
  splashLogoUrl: string | null;
};

export const defaultPlatformBranding: PlatformBranding = {
  appName: DEFAULT_APP_NAME,
  logoUrl: null,
  loginBackgroundUrl: null,
  splashBackgroundUrl: null,
  splashLogoUrl: null,
};
