import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useAutoLocation } from '../../src/hooks/useAutoLocation';
import { useUnreadChatTotal } from '../../src/hooks/useChatThreads';
import { useUnreadNotificationCount } from '../../src/hooks/useNotifications';

/** Raised, prominent center "+" that opens the Add tab from anywhere. */
function AddTabButton({ onPress }: BottomTabBarButtonProps) {
  return (
    <View style={addBtn.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={addBtn.btn}
        android_ripple={{ color: '#1e40af', borderless: true }}
        accessibilityLabel="Add cards"
      >
        <Ionicons name="add" size={30} color="white" />
      </Pressable>
    </View>
  );
}

const addBtn = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: {
    top: -14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});

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

/** Header-left of the Feed: a shortcut into the global marketplace. */
function MarketplaceButton() {
  return (
    <Link href="/marketplace" asChild>
      <Pressable hitSlop={12} style={{ marginLeft: 16 }}>
        <Ionicons name="storefront-outline" size={24} color="#2563EB" />
      </Pressable>
    </Link>
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
  const { profile } = useAuth();
  useAutoLocation(); // ask once on entry, then keep location current automatically
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563EB' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
          headerLeft: () => <MarketplaceButton />,
          headerRight: () => <FeedHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
          headerRight: () => (
            <Link href="/wishlist" asChild>
              <Pressable hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 16 }}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={{ color: '#B45309', fontWeight: '700' }}>Wishlist</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add cards',
          tabBarLabel: () => null,
          tabBarButton: (props) => <AddTabButton {...props} />,
        }}
      />
      {/* Wishlist stays reachable at /wishlist (via Collection) but is off the tab bar. */}
      <Tabs.Screen name="wishlist" options={{ title: 'Wishlist', href: null }} />
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
          tabBarIcon: ({ color, size, focused }) =>
            profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{ width: size, height: size, borderRadius: size / 2, borderWidth: focused ? 2 : 0, borderColor: color }}
              />
            ) : (
              <Ionicons name="person-circle" color={color} size={size} />
            ),
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12} style={{ marginRight: 16 }}>
                <Ionicons name="settings-outline" size={23} color="#2563EB" />
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}
