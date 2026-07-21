import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export interface OrderSummary {
  id: string;
  role: 'buyer' | 'seller';
  status: OrderStatus;
  cardName: string;
  setName: string | null;
  thumb: string | null;
  itemPrice: number;
  total: number;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  buyerId: string | null;
  sellerId: string | null;
  cardPhotos: string[];
  cardImage: string | null;
  buyerFee: number;
  shippingAddress: {
    name?: string; line1?: string; line2?: string | null; city?: string;
    county?: string | null; postal_code?: string; phone?: string | null;
  } | null;
  trackingRef: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  autoReleaseAt: string | null;
}

const ORDER_COLS =
  'id, status, buyer_id, seller_id, card_name, set_name, card_image, card_photos, item_price, buyer_fee, total, shipping_address, tracking_ref, created_at, paid_at, shipped_at, completed_at, auto_release_at';

function toDetail(r: any, meId: string): OrderDetail {
  const role: 'buyer' | 'seller' = r.buyer_id === meId ? 'buyer' : 'seller';
  return {
    id: r.id,
    role,
    status: r.status,
    cardName: r.card_name,
    setName: r.set_name,
    thumb: r.card_photos?.[0] ?? r.card_image ?? null,
    cardImage: r.card_image ?? null,
    cardPhotos: r.card_photos ?? [],
    itemPrice: Number(r.item_price),
    buyerFee: Number(r.buyer_fee),
    total: Number(r.total),
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    shippingAddress: r.shipping_address ?? null,
    trackingRef: r.tracking_ref,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    shippedAt: r.shipped_at,
    completedAt: r.completed_at,
    autoReleaseAt: r.auto_release_at,
  };
}

/** All my orders (both sides); pending_payment rows are checkout debris, hidden. */
export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', user?.id],
    enabled: isSupabaseConfigured && Boolean(user?.id),
    queryFn: async (): Promise<OrderDetail[]> => {
      const { data, error } = await supabase!
        .from('orders')
        .select(ORDER_COLS)
        .neq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((r: any) => toDetail(r, user!.id));
    },
  });
}

export function useOrder(orderId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['order', orderId],
    enabled: isSupabaseConfigured && Boolean(user?.id) && Boolean(orderId),
    queryFn: async (): Promise<OrderDetail | null> => {
      const { data, error } = await supabase!
        .from('orders')
        .select(ORDER_COLS)
        .eq('id', orderId!)
        .maybeSingle();
      if (error) throw error;
      return data ? toDetail(data, user!.id) : null;
    },
  });
}

/** Seller: paid -> shipped (RPC arms the 14-day auto-release + notifies buyer). */
export function useMarkShipped() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, tracking }: { orderId: string; tracking?: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.rpc('order_mark_shipped', {
        p_order: orderId,
        p_tracking: tracking ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** Buyer confirm-received (or seller claim past due): releases the escrow. */
export function useReleaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.functions.invoke('stripe-release', {
        body: { order_id: orderId },
      });
      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
