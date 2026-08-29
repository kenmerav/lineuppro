interface MusicKitInstance {
  isAuthorized: boolean;
  setQueue(queue: { song: string; startTime?: number }): Promise<unknown>;
  play(): Promise<unknown>;
  stop(): Promise<unknown>;
  authorize(): Promise<string>;
}

interface MusicKitGlobal {
  configure(configuration: {
    developerToken: string;
    app: { name: string; build: string };
  }): MusicKitInstance;
}

declare global {
  interface Window {
    MusicKit?: MusicKitGlobal;
  }
}

const MUSIC_KIT_URL = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
let musicKitPromise: Promise<MusicKitInstance> | null = null;

const loadMusicKitScript = async () => {
  if (window.MusicKit) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MUSIC_KIT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Apple Music could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MUSIC_KIT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Apple Music could not be loaded."));
    document.head.appendChild(script);
  });

  if (!window.MusicKit) throw new Error("Apple Music could not be loaded.");
};

export const getAppleMusic = async () => {
  if (!musicKitPromise) {
    musicKitPromise = (async () => {
      await loadMusicKitScript();
      const response = await fetch("/api/apple-music/developer-token");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.developerToken !== "string") {
        throw new Error(payload.error || "Apple Music is not ready yet.");
      }
      return window.MusicKit!.configure({
        developerToken: payload.developerToken,
        app: { name: "Lineup Pro", build: "1.0.0" },
      });
    })().catch((error) => {
      musicKitPromise = null;
      throw error;
    });
  }
  return musicKitPromise;
};

export const authorizeAppleMusic = async () => {
  const music = await getAppleMusic();
  if (!music.isAuthorized) await music.authorize();
  return music;
};

export const appleMusicSongIdFromUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (!/(^|\.)music\.apple\.com$/i.test(url.hostname)) return null;
    const queryId = url.searchParams.get("i");
    if (queryId && /^\d+$/.test(queryId)) return queryId;

    const pathId = url.pathname.split("/").filter(Boolean).at(-1);
    return pathId && /^\d+$/.test(pathId) ? pathId : null;
  } catch {
    return null;
  }
};
