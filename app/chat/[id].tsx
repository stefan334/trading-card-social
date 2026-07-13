import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useChatThread } from '../../src/hooks/useChatThread';
import { useThreadMessages, type ChatMessage } from '../../src/hooks/useThreadMessages';
import { uploadImage } from '../../src/services/supabase/storage';

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {message.imageUrl ? (
          <Image source={{ uri: message.imageUrl }} style={styles.image} contentFit="cover" />
        ) : null}
        {message.body ? <Text style={mine ? styles.mineText : styles.theirsText}>{message.body}</Text> : null}
      </View>
    </View>
  );
}

/** 1:1 message thread, routed as /chat/[id]. Realtime messages + send + mark-read. */
export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: meta } = useChatThread(id);
  const { data: messages, isLoading } = useThreadMessages(id);
  const { sendMessage, markRead } = useChatActions();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

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

  const [sendingImage, setSendingImage] = useState(false);

  function handleSend() {
    if (!id || !text.trim()) return;
    sendMessage.mutate({ threadId: id, body: text });
    setText('');
  }

  async function attachImage() {
    if (!id || !user) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    setSendingImage(true);
    try {
      const url = await uploadImage(res.assets[0].base64, user.id, 'chat');
      sendMessage.mutate({ threadId: id, imageUrl: url });
    } finally {
      setSendingImage(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // iOS: pad up by the keyboard. Android: let the window resize natively —
      // KeyboardAvoiding=padding on Android leaves the composer stuck up high
      // after the keyboard closes.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
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

      <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
        <Pressable style={styles.attach} onPress={attachImage} disabled={sendingImage}>
          {sendingImage ? <ActivityIndicator size="small" /> : <Ionicons name="image" size={24} color="#2563EB" />}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={[styles.send, !text.trim() && styles.sendDisabled]} onPress={handleSend} disabled={!text.trim()}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
