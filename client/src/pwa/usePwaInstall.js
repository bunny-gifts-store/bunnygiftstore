import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, promptInstall, isIos } from './installPrompt.js';

/**
 * Everything an install button needs.
 *
 * `canInstall` is intentionally conservative: it is only true when the browser
 * has actually offered a prompt (Chrome, Edge, Samsung Internet, Android
 * Chrome), or when we're on iOS where installing is a documented manual step.
 * Browsers with no install support at all (e.g. desktop Firefox) get nothing,
 * so no dead button is ever rendered.
 */
export default function usePwaInstall() {
  const { canPrompt, installed } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // iOS can install, but only via Share → Add to Home Screen.
  const needsManualSteps = !installed && !canPrompt && isIos();

  return {
    installed,
    canInstall: !installed && (canPrompt || needsManualSteps),
    needsManualSteps,
    install: promptInstall,
  };
}
