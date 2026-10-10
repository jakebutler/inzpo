import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { InzpoClient, MobileKit } from '@inzpo/shared';
import { useInzpoClient } from './api';
import { handoffPhoto } from './photo-handoff';
import { uploadPhoto, type PhotoInput } from './upload';

type CaptureSnapshot = {
  photo: NonNullable<MobileKit['photo']>;
  phase: 'keeping' | 'processing';
  kitId: string | null;
  error: boolean;
};
type Capture = { input: PhotoInput; snapshot: CaptureSnapshot; started: boolean;
  request: Promise<void> | null; listeners: Set<() => void> };
const captures = new Map<string, Capture>();
let serial = 0;

/** Only the opaque local ID enters navigation; photo URIs remain in memory. */
export function beginCapture(photo: PhotoInput) {
  const id = `capture-${Date.now().toString(36)}-${++serial}`;
  captures.set(id, { input: photo, started: false, request: null, listeners: new Set(),
    snapshot: { photo: { url: photo.uri, width: photo.width, height: photo.height, placeholder: null },
      phase: 'keeping', kitId: null, error: false } });
  return id;
}

export function captureSnapshot(id: string | null) {
  return id ? captures.get(id)?.snapshot ?? null : null;
}

function update(capture: Capture, patch: Partial<CaptureSnapshot>) {
  capture.snapshot = { ...capture.snapshot, ...patch };
  capture.listeners.forEach(notify => notify());
}

/** A route remount or focus change may subscribe again, but never re-upload. */
export function runCapture(id: string, client: InzpoClient, retry = false) {
  const capture = captures.get(id);
  if (!capture || capture.request || capture.snapshot.kitId || (capture.started && !retry)) return capture?.request;
  capture.started = true;
  update(capture, { phase: 'keeping', error: false });
  capture.request = uploadPhoto(client, capture.input, () => update(capture, { phase: 'processing' }))
    .then(kitId => {
      handoffPhoto(kitId, capture.input);
      update(capture, { kitId, phase: 'processing' });
    }).catch(() => update(capture, { error: true }))
    .finally(() => { capture.request = null; });
  return capture.request;
}

export function useCaptureSession(id: string | null) {
  const client = useInzpoClient();
  const subscribe = useCallback((notify: () => void) => {
    const capture = id ? captures.get(id) : null;
    capture?.listeners.add(notify);
    return () => { capture?.listeners.delete(notify); };
  }, [id]);
  const snapshot = useSyncExternalStore(subscribe, () => captureSnapshot(id), () => null);
  useEffect(() => { if (id) void runCapture(id, client); }, [id, client]);
  const retry = useCallback(() => { if (id) void runCapture(id, client, true); }, [id, client]);
  return { snapshot, retry };
}
