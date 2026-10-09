import { InzpoApiError, pollBrief, type MobileKit } from '@inzpo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInzpoClient } from './api';

type KitState = {
  id: string;
  attempt: number;
  kit: MobileKit | null;
  error: 'notFound' | 'load' | null;
  briefFailed: boolean;
};

export function useKit(id: string) {
  const client = useInzpoClient();
  const clientRef = useRef(client);
  useEffect(() => { clientRef.current = client; }, [client]);
  const [state, setState] = useState<KitState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const replacement = useRef(0);
  const route = useRef(id);
  useEffect(() => { route.current = id; }, [id]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const replaceKit = useCallback((kit: MobileKit) => {
    if (kit.id !== id || route.current !== id) return;
    replacement.current += 1;
    setState((current) => ({ id, attempt, error: null,
      kit: current?.id === id && current.kit && ((kit.brief.status === 'pending' && current.kit.brief.status !== 'pending')
        || kit.brief.updatedAt < current.kit.brief.updatedAt)
        ? { ...kit, brief: current.kit.brief } : kit,
      briefFailed: kit.brief.status === 'pending' && current?.id === id ? current.briefFailed : false,
    }));
  }, [id, attempt]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const scope = { id, attempt };
    const client = clientRef.current;

    async function load() {
      if (!id) return;
      const loadReplacement = replacement.current;
      let initial: MobileKit;
      try {
        initial = await client.getKit(id);
      } catch (failure) {
        if (active) {
          setState((current) => current?.id === id && current.kit
            ? { ...current, attempt }
            : { ...scope, kit: null, briefFailed: false,
              error: failure instanceof InzpoApiError && failure.status === 404 ? 'notFound' : 'load' });
        }
        return;
      }
      if (!active) return;
      if (replacement.current === loadReplacement) {
        setState((current) => ({ ...scope, error: null,
          kit: current?.id === id && current.kit && ((initial.brief.status === 'pending' && current.kit.brief.status !== 'pending')
            || initial.brief.updatedAt < current.kit.brief.updatedAt)
            ? { ...initial, brief: current.kit.brief } : initial,
          briefFailed: initial.brief.status === 'pending' && current?.id === id ? current.briefFailed : false,
        }));
      }
      if (initial.brief.status !== 'pending') return;

      try {
        const brief = await pollBrief(client, id, {
          intervalMs: 1500, timeoutMs: 60000, signal: controller.signal,
        });
        if (!active) return;
        setState((current) => current?.id === id && current.kit && brief.updatedAt >= current.kit.brief.updatedAt
          ? { ...current, briefFailed: false, kit: { ...current.kit, brief } } : current);
        // The brief can rename the kit. Refresh its title and signed photo URL.
        // If that refresh fails, retain the resolved brief and the loaded kit.
        const refreshReplacement = replacement.current;
        const refreshed = await client.getKit(id).catch(() => null);
        if (active && refreshed && replacement.current === refreshReplacement) {
          setState((current) => {
            const resolved = refreshed.brief.status === 'pending' || refreshed.brief.updatedAt < brief.updatedAt ? brief : refreshed.brief;
            return { ...scope, error: null, briefFailed: false,
              kit: { ...refreshed, brief: current?.id === id && current.kit && current.kit.brief.updatedAt > resolved.updatedAt
                ? current.kit.brief : resolved },
            };
          });
        }
      } catch {
        if (active && !controller.signal.aborted) {
          setState((current) => current?.id === id && current.kit?.brief.status === 'pending'
            ? { ...current, briefFailed: true } : current);
        }
      }
    }

    void load();
    return () => { active = false; controller.abort(); };
  }, [id, attempt]);

  // Retain this route's loaded kit during retries and auth updates.
  const current = state?.id === id && (state.kit || state.attempt === attempt) ? state : null;
  return {
    kit: current?.kit ?? null,
    loading: !!id && !current,
    error: !id ? 'notFound' as const : current?.error ?? null,
    briefFailed: current?.briefFailed ?? false,
    retry,
    replaceKit,
  };
}
