import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Module-level dispatcher so non-React code (e.g. the react-query MutationCache
// onError) can raise a toast without threading a context through every hook.
let dispatch: ((message: string) => void) | null = null;

/** Show a transient error/info toast from anywhere. Safe to call before mount (no-op). */
export function showToast(message: string) {
  dispatch?.(message);
}

/** Turn an unknown thrown value into something worth showing a human. */
export function toastMessage(e: unknown): string {
  const raw = (e as any)?.message ?? String(e ?? '');
  if (!raw || raw === 'undefined' || raw.length > 140) return 'Something went wrong. Please try again.';
  return raw;
}

const VISIBLE_MS = 3500;

/** Mount once near the app root; renders the current toast above the tab bar. */
export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    dispatch = (msg: string) => {
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setMessage(null)
        );
      }, VISIBLE_MS);
    };
    return () => {
      dispatch = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!message) return null;
  return (
    <Animated.View style={[styles.toast, { opacity, bottom: 70 + insets.bottom }]} pointerEvents="none">
      <Text style={styles.text} numberOfLines={3}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: '#111827EE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  text: { color: 'white', fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});
