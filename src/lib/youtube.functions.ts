import { createServerFn } from "@tanstack/react-start";

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => ["live", "shorts", "embed"].includes(p));
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL
  }
  return null;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface LiveInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  // Opaque state used by getChatMessages
  apiKey: string;
  clientVersion: string;
  continuation: string;
}

interface YtCfg {
  apiKey: string;
  clientName: string;
  clientVersion: string;
  continuation: string;
  title: string;
  channelTitle: string;
}

async function fetchLiveChatBootstrap(videoId: string): Promise<YtCfg> {
  // Load the live_chat iframe page; contains INNERTUBE_API_KEY + initial continuation
  const res = await fetch(
    `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`,
    {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    }
  );
  if (!res.ok) throw new Error(`No se pudo cargar la página de chat (${res.status})`);
  const html = await res.text();

  const apiKey =
    html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ??
    html.match(/innertubeApiKey":"([^"]+)"/)?.[1];
  const clientVersion =
    html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] ??
    html.match(/"clientVersion":"([^"]+)"/)?.[1];
  const clientName =
    html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":"?([^",}]+)"?/)?.[1] ?? "WEB";

  if (!apiKey || !clientVersion) {
    throw new Error(
      "No se pudo inicializar el chat. Verifica que el video esté en vivo y sea público."
    );
  }

  // ytInitialData contains the initial continuation
  const initialDataMatch =
    html.match(/window\["ytInitialData"\]\s*=\s*(\{[\s\S]+?\});/) ??
    html.match(/var\s+ytInitialData\s*=\s*(\{[\s\S]+?\});<\/script>/) ??
    html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});/);
  if (!initialDataMatch) throw new Error("No se encontró el estado inicial del chat.");

  let initialData: any;
  try {
    initialData = JSON.parse(initialDataMatch[1]);
  } catch {
    throw new Error("No se pudo leer el estado inicial del chat.");
  }

  const subs =
    initialData?.contents?.liveChatRenderer?.continuations ??
    initialData?.continuationContents?.liveChatContinuation?.continuations;
  const continuation =
    subs?.[0]?.invalidationContinuationData?.continuation ??
    subs?.[0]?.timedContinuationData?.continuation ??
    subs?.[0]?.reloadContinuationData?.continuation;

  if (!continuation) {
    throw new Error(
      "Este video no tiene un chat en vivo activo o el chat está deshabilitado."
    );
  }

  // Title / channel — try to grab from initial data; fall back to oembed
  let title = "";
  let channelTitle = "";
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (oembed.ok) {
      const j = await oembed.json();
      title = j.title ?? "";
      channelTitle = j.author_name ?? "";
    }
  } catch {}

  return { apiKey, clientName, clientVersion, continuation, title, channelTitle };
}

export const getLiveInfo = createServerFn({ method: "POST" })
  .inputValidator((input: { input: string }) => {
    if (!input || typeof input.input !== "string") throw new Error("Invalid input");
    return input;
  })
  .handler(async ({ data }): Promise<LiveInfo> => {
    const videoId = extractVideoId(data.input);
    if (!videoId) throw new Error("No se pudo extraer el ID del video desde la URL");

    const cfg = await fetchLiveChatBootstrap(videoId);

    return {
      videoId,
      title: cfg.title,
      channelTitle: cfg.channelTitle,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      apiKey: cfg.apiKey,
      clientVersion: cfg.clientVersion,
      continuation: cfg.continuation,
    };
  });

export interface ChatMessage {
  id: string;
  publishedAt: string;
  authorName: string;
  authorPhoto: string;
  authorChannelId: string;
  isChatOwner: boolean;
  isChatModerator: boolean;
  isChatSponsor: boolean;
  isVerified: boolean;
  message: string;
  type: string;
  superChatAmount?: string;
  superChatTier?: number;
}

export interface ChatPage {
  messages: ChatMessage[];
  continuation: string | null;
  pollingIntervalMillis: number;
}

function parseRuns(runs: any[] | undefined): string {
  if (!runs) return "";
  return runs
    .map((r: any) => {
      if (typeof r?.text === "string") return r.text;
      if (r?.emoji) {
        return (
          r.emoji.shortcuts?.[0] ??
          r.emoji.emojiId ??
          r.emoji.image?.accessibility?.accessibilityData?.label ??
          ""
        );
      }
      return "";
    })
    .join("");
}

function parseAction(action: any): ChatMessage | null {
  const item =
    action?.addChatItemAction?.item ??
    action?.replayChatItemAction?.actions?.[0]?.addChatItemAction?.item;
  if (!item) return null;

  const renderer =
    item.liveChatTextMessageRenderer ??
    item.liveChatPaidMessageRenderer ??
    item.liveChatPaidStickerRenderer ??
    item.liveChatMembershipItemRenderer;
  if (!renderer) return null;

  const badges: any[] = renderer.authorBadges ?? [];
  let isChatOwner = false;
  let isChatModerator = false;
  let isChatSponsor = false;
  let isVerified = false;
  for (const b of badges) {
    const r = b.liveChatAuthorBadgeRenderer;
    if (!r) continue;
    const t = r.tooltip?.toLowerCase?.() ?? "";
    if (r.icon?.iconType === "OWNER" || t.includes("owner")) isChatOwner = true;
    else if (r.icon?.iconType === "MODERATOR" || t.includes("moderator"))
      isChatModerator = true;
    else if (r.icon?.iconType === "VERIFIED" || t.includes("verified"))
      isVerified = true;
    else if (r.customThumbnail) isChatSponsor = true;
  }

  let type = "textMessageEvent";
  let superChatAmount: string | undefined;
  let superChatTier: number | undefined;
  let message = "";

  if (item.liveChatTextMessageRenderer) {
    message = parseRuns(renderer.message?.runs);
  } else if (item.liveChatPaidMessageRenderer) {
    type = "superChatEvent";
    message = parseRuns(renderer.message?.runs);
    superChatAmount = renderer.purchaseAmountText?.simpleText;
  } else if (item.liveChatPaidStickerRenderer) {
    type = "superStickerEvent";
    superChatAmount = renderer.purchaseAmountText?.simpleText;
    message =
      renderer.sticker?.accessibility?.accessibilityData?.label ?? "Super Sticker";
  } else if (item.liveChatMembershipItemRenderer) {
    type = "newSponsorEvent";
    message =
      parseRuns(renderer.headerSubtext?.runs) ??
      renderer.headerSubtext?.simpleText ??
      "Nuevo miembro";
  }

  const photo =
    renderer.authorPhoto?.thumbnails?.[renderer.authorPhoto.thumbnails.length - 1]
      ?.url ?? "";

  return {
    id: renderer.id,
    publishedAt: renderer.timestampUsec
      ? new Date(Number(renderer.timestampUsec) / 1000).toISOString()
      : new Date().toISOString(),
    authorName: renderer.authorName?.simpleText ?? "",
    authorPhoto: photo,
    authorChannelId: renderer.authorExternalChannelId ?? "",
    isChatOwner,
    isChatModerator,
    isChatSponsor,
    isVerified,
    message,
    type,
    superChatAmount,
    superChatTier,
  };
}

export const getChatMessages = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { apiKey: string; clientVersion: string; continuation: string }) => {
      if (!input?.apiKey || !input?.clientVersion || !input?.continuation)
        throw new Error("Estado de chat inválido");
      return input;
    }
  )
  .handler(async ({ data }): Promise<ChatPage> => {
    const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(
      data.apiKey
    )}&prettyPrint=false`;
    const body = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: data.clientVersion,
          hl: "en",
          gl: "US",
        },
      },
      continuation: data.continuation,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube chat error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const cont = json?.continuationContents?.liveChatContinuation;
    const actions: any[] = cont?.actions ?? [];
    const messages: ChatMessage[] = [];
    for (const a of actions) {
      const m = parseAction(a);
      if (m) messages.push(m);
    }

    const subs = cont?.continuations?.[0];
    const next =
      subs?.invalidationContinuationData?.continuation ??
      subs?.timedContinuationData?.continuation ??
      subs?.reloadContinuationData?.continuation ??
      null;
    const timeoutMs =
      subs?.invalidationContinuationData?.timeoutMs ??
      subs?.timedContinuationData?.timeoutMs ??
      5000;

    return {
      messages,
      continuation: next,
      pollingIntervalMillis: timeoutMs,
    };
  });
