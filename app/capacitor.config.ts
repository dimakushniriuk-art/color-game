import type { CapacitorConfig } from '@capacitor/cli';

// appId must be unique on the stores: change it before the first publication
// (e.g. com.<yourdomain>.colorgame) — it cannot be changed afterwards.
const config: CapacitorConfig = {
  appId: 'com.colorgame.app',
  appName: 'Color Game',
  webDir: 'dist',
  backgroundColor: '#fff8f1',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
