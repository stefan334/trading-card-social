import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Card, CardSet } from '../types/card';

export interface BatchItem {
  key: string;
  card: Card;
  set: CardSet;
}

interface BatchContextValue {
  items: BatchItem[];
  add: (card: Card, set: CardSet) => void;
  removeAt: (key: string) => void;
  /** Remove one copy of a card id from the tray (the most recently added). */
  removeOne: (cardId: string) => void;
  clear: () => void;
}

const BatchContext = createContext<BatchContextValue | undefined>(undefined);

/**
 * Holds a tray of cards being added together (e.g. opening a pack). Both the
 * scanner and the batch screen push into it; committing adds them all at once,
 * which the feed groups into a single "added N cards" post.
 */
export function BatchProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const add = useCallback((card: Card, set: CardSet) => {
    setItems((prev) => [...prev, { key: `${card.id}-${Date.now()}-${Math.random()}`, card, set }]);
  }, []);
  const removeAt = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const removeOne = useCallback(
    (cardId: string) =>
      setItems((prev) => {
        let lastIdx = -1;
        for (let i = 0; i < prev.length; i++) if (prev[i].card.id === cardId) lastIdx = i;
        return lastIdx === -1 ? prev : prev.filter((_, i) => i !== lastIdx);
      }),
    []
  );
  const clear = useCallback(() => setItems([]), []);

  return <BatchContext.Provider value={{ items, add, removeAt, removeOne, clear }}>{children}</BatchContext.Provider>;
}

export function useBatch(): BatchContextValue {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error('useBatch must be used within a <BatchProvider>');
  return ctx;
}
