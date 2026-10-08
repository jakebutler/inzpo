import { InzpoApiError, pollBrief, type InzpoClient, type MobileKit } from '@inzpo/shared';
import { useCallback, useEffect, useState } from 'react';
import { useInzpoClient } from './api';

type KitState = {
  id: string;
  client: InzpoClient;
  attempt: number;
  kit: MobileKit | null;
  error: 'notFound' | 'load' | null;
  briefFailed: boolean;
};

export function useKit(id: string) {
  const client = useInzpoClient();
  const [state, setState] = useState<KitState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const scope = { id, client, attempt };

    async function load() {
      if (!id) return;
      let initial: MobileKit;
      try {
        initial = await client.getKit(id);
      } catch (failure) {
        if (active) {
          setState({
            ...scope, kit: null, briefFailed: false,
            error: failure instanceof InzpoApiError && failure.status === 404 ? 'notFound' : 'load',
          });
        }
        return;
      }
      if (!active) return;
      setState({ ...scope, kit: initial, error: null, briefFailed: false });
      if (initial.brief.status !== 'pending') return;

      try {
        const brief = await pollBrief(client, id, {
          intervalMs: 1500, timeoutMs: 60000, signal: controller.signal,
        });
        if (!active) return;
        setState((current) => current?.kit ? { ...current, kit: { ...current.kit, brief } } : current);
        // The brief can rename the kit. Refresh its title and signed photo URL.
        // If that refresh fails, retain the resolved brief and the loaded kit.
        const refreshed = await client.getKit(id).catch(() => null);
        if (active && refreshed) {
          setState({
            ...scope, error: null, briefFailed: false,
            kit: { ...refreshed, brief: refreshed.brief.status === 'pending' ? brief : refreshed.brief },
          });
        }
      } catch {
        if (active && !controller.signal.aborted) {
          setState((current) => current ? { ...current, briefFailed: true } : current);
        }
      }
    }

    void load();
    return () => { active = false; controller.abort(); };
  }, [client, id, attempt]);

  // A changed route/client/retry immediately reads as loading, without an extra
  // render from synchronously resetting state inside an effect.
  const current = state?.id === id && state.client === client && state.attempt === attempt ? state : null;
  return {
    kit: current?.kit ?? null,
    loading: !!id && !current,
    error: !id ? 'notFound' as const : current?.error ?? null,
    briefFailed: current?.briefFailed ?? false,
    retry,
  };
}
