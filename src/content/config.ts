export const remoteContentConfig = {
  manifestUrl: (process.env.EXPO_PUBLIC_CONTENT_MANIFEST_URL ?? '').trim(),
  password: (process.env.EXPO_PUBLIC_CONTENT_PASSWORD ?? '').trim(),
};

export function isRemoteContentConfigured() {
  return remoteContentConfig.manifestUrl.length > 0 && remoteContentConfig.password.length > 0;
}
