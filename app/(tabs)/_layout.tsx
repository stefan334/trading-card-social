import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUnreadChatTotal } from '../../src/hooks/useChatThreads';
import { useUnreadNotificationCount } from '../../src/hooks/useNotifications';

/** Top-right of the Feed: notifications bell (with unread badge) + search. */
function FeedHeaderRight() {
  const { data: unread } = useUnreadNotificationCount();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 16 }}>
      <Link href="/notifications" asChild>
        <Pressable hitSlop={12}>
          <Ionicons name="notifications-outline" size={25} color="#2563EB" />
          {unread ? (
            <View style={badge.dot}>
              <Text style={badge.text}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </Link>
      <Link href="/search" asChild>
        <Pressable hitSlop={12}>
          <Ionicons name="search" size={24} color="#2563EB" />
        </Pressable>
      </Link>
    </View>
  );
}

const badge = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  text: { color: 'white', fontSize: 10, fontWeight: '700' },
});

export default function TabLayout() {
  const unreadChats = useUnreadChatTotal();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563EB' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
          headerRight: () => <FeedHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color, size }) => <Ionicons name="star" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
          tabBarBadge: unreadChats > 0 ? (unreadChats > 9 ? '9+' : unreadChats) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
