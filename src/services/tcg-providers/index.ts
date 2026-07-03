import type { TcgProvider } from '../../types/card';
import { pokemonProvider } from './pokemon';

const providers: Record<string, TcgProvider> = {
  [pokemonProvider.gameId]: pokemonProvider,
};

export function getProvider(gameId: string): TcgProvider {
  const provider = providers[gameId];
  if (!provider) throw new Error(`No TCG provider registered for gameId "${gameId}"`);
  return provider;
}

export function listProviders(): TcgProvider[] {
  return Object.values(providers);
}

export { pokemonProvider };
