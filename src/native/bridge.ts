import type { PluginListenerHandle } from '@capacitor/core';

export type VoiceLang = 'bn-BD' | 'en-US';

export interface VoiceStatus {
  supported: boolean;
  installed: VoiceLang[];
  downloadable: VoiceLang[];
  pending: VoiceLang[];
  languageSwitch: boolean;
  micPermission: 'granted' | 'denied' | 'prompt';
}

export type VoiceErrorCode = 'no_match' | 'no_speech' | 'busy' | 'language_unavailable' | 'permission' | 'other';

interface VoiceEvents {
  partial: { text: string };
  final: { text: string; alternatives: string[]; lang?: string };
  level: { rms: number };
  end: Record<string, never>;
  error: { code: VoiceErrorCode };
}

interface DaylineNativePlugin {
  voiceStatus(): Promise<VoiceStatus>;
  requestMic(): Promise<{ granted: boolean }>;
  download(opts: { lang: VoiceLang }): Promise<{ started: boolean }>;
  start(opts: { primary: VoiceLang; also?: VoiceLang[]; maxMs?: number }): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  keepAwake(opts: { on: boolean }): Promise<void>;
  addListener<E extends keyof VoiceEvents>(event: E, cb: (data: VoiceEvents[E]) => void): Promise<PluginListenerHandle>;
}

// A Capacitor plugin is a Proxy that answers every property, including `then`,
// so it must never be the resolved value of a promise. Keep it in a box.
let box: { plugin: DaylineNativePlugin } | null = null;

async function native(): Promise<{ plugin: DaylineNativePlugin }> {
  if (!box) {
    const { registerPlugin } = await import('@capacitor/core');
    box ??= { plugin: registerPlugin<DaylineNativePlugin>('DaylineNative') };
  }
  return box;
}

export const voiceStatus = async () => (await native()).plugin.voiceStatus();
export const requestMic = async () => (await native()).plugin.requestMic();
export const downloadVoice = async (lang: VoiceLang) => (await native()).plugin.download({ lang });
export const startVoice = async (opts: { primary: VoiceLang; also?: VoiceLang[]; maxMs?: number }) => (await native()).plugin.start(opts);
export const stopVoice = async () => (await native()).plugin.stop();
export const cancelVoice = async () => (await native()).plugin.cancel();
export const keepAwake = async (on: boolean) => (await native()).plugin.keepAwake({ on });

export async function onVoice<E extends keyof VoiceEvents>(event: E, cb: (data: VoiceEvents[E]) => void): Promise<() => void> {
  const handle = await (await native()).plugin.addListener(event, cb);
  return () => void handle.remove();
}

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Write files to the app's cache and open Android's share sheet. */
export async function shareFiles(files: File[], title?: string): Promise<'shared' | 'cancelled'> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const uris: string[] = [];
  for (const file of files) {
    const path = `share/${file.name.replace(/[\\/:*?"<>|]+/g, '-')}`;
    const { uri } = await Filesystem.writeFile({ path, data: await toBase64(file), directory: Directory.Cache, recursive: true });
    uris.push(uri);
  }
  try {
    await Share.share({ title: title ?? files[0]?.name, files: uris });
    return 'shared';
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelled';
    throw e;
  }
}
