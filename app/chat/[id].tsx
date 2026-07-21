import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttachmentTray } from '../../src/components/AttachmentTray';
import { useAuth } from '../../src/context/AuthContext';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useChatThread } from '../../src/hooks/useChatThread';
import { useImageAttachments } from '../../src/hooks/useImageAttachments';
import { useKeyboardHeight } from '../../src/hooks/useKeyboardHeight';
import { useThreadMessages, type ChatMessage } from '../../src/hooks/useThreadMessages';
import { uploadImage } from '../../src/services/supabase/storage';
import { useTheme } from '../../src/theme';

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : { backgroundColor: colors.surface, borderBottomLeftRadius: 4 }]}>
        {message.imageUrl ? (
          <Image source={{ uri: message.imageUrl }} style={styles.image} contentFit="cover" />
        ) : null}
        {message.body ? <Text style={mine ? styles.mineText : { color: colors.text, fontSize: 15 }}>{message.body}</Text> : null}
      </View>
    </View>
  );
}

/** 1:1 message thread, routed as /chat/[id]. Realtime messages + send + mark-read. */
export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: meta } = useChatThread(id);
  const { data: messages, isLoading } = useThreadMessages(id);
  const { sendMessage, markRead } = useChatActions();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();

  // Manual keyboard handling (shared hook): KeyboardAvoidingView + edge-to-edge
  // (Expo SDK 54) leaves the composer behind the keyboard on Android — lift the
  // whole conversation by the keyboard height and follow to the latest message.
  const keyboardHeight = useKeyboardHeight();
  useEffect(() => {
    if (keyboardHeight > 0) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [keyboardHeight]);

  // Mark read on open and whenever new messages arrive while the thread is open.
  useEffect(() => {
    if (id) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages?.length]);

  const title = meta?.other?.displayName || meta?.other?.username || 'Chat';
  const otherId = meta?.other?.id;

  // Jump to the newest message when the thread opens / a message arrives.
  useEffect(() => {
    if (messages?.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    }
  }, [messages?.length]);

  // Photos stage into a tray first (multi-select) and only go out when the
  // user confirms with Send — the first photo carries the typed text.
  const { staged, pick, removeAt, clear } = useImageAttachments();
  const [sendingImage, setSendingImage] = useState(false);
  const canSend = Boolean(text.trim() || staged.length);

  async function handleSend() {
    if (!id || !user || !canSend || sendingImage) return;
    if (!staged.length) {
      sendMessage.mutate({ threadId: id, body: text });
      setText('');
      return;
    }
    setSendingImage(true);
    try {
      for (let i = 0; i < staged.length; i++) {
        const url = await uploadImage(staged[i].base64, user.id, 'chat');
        await sendMessage.mutateAsync({ threadId: id, body: i === 0 ? text : undefined, imageUrl: url });
      }
      setText('');
      clear();
    } finally {
      setSendingImage(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: keyboardHeight > 0 ? keyboardHeight : insets.bottom }]}>
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            otherId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 12 }}>
                <Link href={`/trade/new?with=${otherId}`} asChild>
                  <Pressable hitSlop={8}>
                    <Ionicons name="swap-horizontal" size={24} color="#2563EB" />
                  </Pressable>
                </Link>
                <Link href={`/user/${otherId}`} asChild>
                  <Pressable hitSlop={8}>
                    <Ionicons name="person-circle-outline" size={24} color="#2563EB" />
                  </Pressable>
                </Link>
              </View>
            ) : undefined,
        }}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble message={item} mine={item.senderId === user?.id} />}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.empty}>Say hi 👋</Text>}
        />
      )}

      <AttachmentTray images={staged} onRemove={removeAt} />
      <View style={[styles.inputBar, { borderTopColor: colors.borderLight }]}>
        <Pressable style={styles.attach} onPress={pick} disabled={sendingImage}>
          <Ionicons name="image" size={24} color="#2563EB" />
        </Pressable>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Message…"
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={[styles.send, (!canSend || sendingImage) && styles.sendDisabled]} onPress={handleSend} disabled={!canSend || sendingImage}>
          {sendingImage ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.sendText}>Send{staged.length ? ` (${staged.length}📷)` : ''}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  list: { padding: 12, gap: 6, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  mineText: { color: 'white', fontSize: 15 },
  theirsText: { color: '#111827', fontSize: 15 },
  image: { width: 180, height: 240, borderRadius: 10, marginBottom: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  attach: { paddingHorizontal: 4, paddingVertical: 9 },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15 },
  send: { backgroundColor: '#2563EB', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: 'white', fontWeight: '700' },
});
