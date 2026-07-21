import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current soft-keyboard height (0 when hidden). KeyboardAvoidingView is
 * unreliable with Expo SDK 54's edge-to-edge Android windows (the window
 * doesn't resize, so inputs end up hidden behind the keyboard) — instead,
 * screens add this as bottom padding so the focused input stays visible.
 * Same manual approach the chat screen shipped with.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
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
