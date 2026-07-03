import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { FeedPost } from '../hooks/useFeed';
import { formatRelativeTime } from '../utils/time';

const TYPE_VERB: Record<FeedPost['type'], string | null> = {
  text: null,
  card_showcase: 'shared a card',
  card_added: 'added a card',
  trade_completed: 'completed a trade',
};

/** A single feed item: author header, optional activity verb, body text, and card/image preview. */
export function PostCard({ post }: { post: FeedPost }) {
  const verb = TYPE_VERB[post.type];
  const name = post.author.displayName || post.author.username;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.author.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={36} color="#9CA3AF" />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {name}
            {verb ? <Text style={styles.verb}> {verb}</Text> : null}
          </Text>
          <Text style={styles.time}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
      </View>

      {post.body ? <Text style={styles.body}>{post.body}</Text> : null}

      {post.card ? (
        <Link href={`/card/${post.card.id}`} asChild>
          <Pressable style={styles.cardPreview}>
            {post.card.imageUrlSmall && (
              <Image source={{ uri: post.card.imageUrlSmall }} style={styles.cardImage} />
            )}
            <Text style={styles.cardName}>{post.card.name}</Text>
          </Pressable>
        </Link>
      ) : post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.attachment} contentFit="cover" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 14, marginHorizontal: 12, marginTop: 12, borderRadius: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { fontWeight: '600', fontSize: 15 },
  verb: { fontWeight: '400', color: '#6B7280' },
  time: { color: '#9CA3AF', fontSize: 12, marginTop: 1 },
  body: { marginTop: 10, lineHeight: 20 },
  cardPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  cardImage: { width: 60, height: 84, borderRadius: 6 },
  cardName: { fontWeight: '600', flex: 1 },
  attachment: { width: '100%', height: 200, borderRadius: 10, marginTop: 12 },
});
