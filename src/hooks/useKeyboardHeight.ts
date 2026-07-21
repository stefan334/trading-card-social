import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Native-inset-driven keyboard events (react-native-keyboard-controller).
// RN's own JS Keyboard events are unreliable on edge-to-edge Android — some
// keyboards (Samsung with its toolbar row) report a stale height and never
// re-fire, leaving the composer half-hidden. The controller reads the IME
// window insets natively and re-emits on every height change. Guarded require:
// in a binary that predates the module (older dev client) we fall back to the
// RN events rather than crash.
let KeyboardEvents: typeof import('react-native-keyboard-controller').KeyboardEvents | null = null;
try {
  KeyboardEvents = require('react-native-keyboard-controller').KeyboardEvents;
} catch {
  KeyboardEvents = null;
}

/**
 * Current soft-keyboard height (0 when hidden). KeyboardAvoidingView is
 * unreliable with Expo SDK 54's edge-to-edge Android windows (the window
 * doesn't resize, so inputs end up hidden behind the keyboard) — instead,
 * screens add this as bottom padding so the focused input stays visible.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (KeyboardEvents) {
      // keyboardDidShow re-fires on height changes (e.g. suggestion bar
      // expanding), so the padding self-corrects on quirky keyboards.
      const showSub = KeyboardEvents.addListener('keyboardDidShow', (e) => setHeight(e.height));
      const hideSub = KeyboardEvents.addListener('keyboardDidHide', () => setHeight(0));
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}
