import { useAuth } from '@clerk/expo';
import { createInzpoClient, type InzpoClient } from '@inzpo/shared';
import { createContext, createElement, useContext, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';

export const DEFAULT_API_BASE_URL =
  'https://inzpo-git-cursor-inzpo-piv-431588-butlerjake-gmailcoms-projects.vercel.app';

export function createMobileClient(getToken: () => Promise<string | null>): InzpoClient {
  return createInzpoClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    getToken,
  });
}

const ClientContext = createContext<InzpoClient | null>(null);

export function InzpoClientProvider({ children }: PropsWithChildren) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  // Client construction stores the callback; it reads the ref only when a request runs.
  // eslint-disable-next-line react-hooks/refs
  const [client] = useState(() => createMobileClient(() => getTokenRef.current()));
  return createElement(ClientContext.Provider, { value: client }, children);
}

export function useInzpoClient(): InzpoClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useInzpoClient requires InzpoClientProvider');
  return client;
}
