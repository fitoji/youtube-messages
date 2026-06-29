import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import Badge from "@/components/Badge";
import Message from "@/components/Message";
import {
  getLiveInfo,
  getChatMessages,
  type LiveInfo,
  type ChatMessage,
} from "@/lib/youtube.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Chat Viewer · YouTube" },
      {
        name: "description",
        content:
          "Visualiza el chat en vivo de cualquier transmisión pública de YouTube en tiempo real, con búsqueda y filtros. Sin API key.",
      },
      { property: "og:title", content: "Live Chat Viewer · YouTube" },
      {
        property: "og:description",
        content: "Mira el chat en vivo de YouTube con filtros en tiempo real.",
      },
    ],
  }),
  component: Index,
});

const MAX_MESSAGES = 500;

function Index() {
  const fetchInfo = useServerFn(getLiveInfo);
  const fetchChat = useServerFn(getChatMessages);

  const [dialogOpen, setDialogOpen] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [info, setInfo] = useState<LiveInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [onlyHighlight, setOnlyHighlight] = useState(false);
  const [onlySuperChat, setOnlySuperChat] = useState(false);
  const [onlyMembers, setOnlyMembers] = useState(false);
  const readStateRef = useRef<Map<string, boolean>>(new Map());
  const [readVersion, setReadVersion] = useState(0);
  const [hideRead, setHideRead] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [themeMounted, setThemeMounted] = useState(false);
  const hoveredMessageIdRef = useRef<string | null>(null);
  const focusedMessageIdRef = useRef<string | null>(null);
  const [fullScreenMessage, setFullScreenMessage] = useState<ChatMessage | null>(null);

  const continuationRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // Hydrate theme from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    if (!info) return;
    stoppedRef.current = false;
    continuationRef.current = info.continuation;
    seenRef.current = new Set();

    const poll = async () => {
      if (stoppedRef.current) return;
      const cont = continuationRef.current;
      if (!cont) return;
      try {
        const page = await fetchChat({
          data: {
            apiKey: info.apiKey,
            clientVersion: info.clientVersion,
            continuation: cont,
          },
        });
        continuationRef.current = page.continuation;
        const fresh = page.messages.filter((m) => {
          if (seenRef.current.has(m.id)) return false;
          seenRef.current.add(m.id);
          return true;
        });
        if (fresh.length) {
          setMessages((prev) => {
            const merged = [...prev, ...fresh];
            return merged.length > MAX_MESSAGES
              ? merged.slice(merged.length - MAX_MESSAGES)
              : merged;
          });
        }
        setError(null);
        if (!stoppedRef.current && continuationRef.current) {
          timerRef.current = setTimeout(poll, Math.max(2000, page.pollingIntervalMillis));
        }
      } catch (e: any) {
        setError(e?.message ?? "Error obteniendo mensajes");
        if (!stoppedRef.current) {
          timerRef.current = setTimeout(poll, 8000);
        }
      }
    };

    poll();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [info, fetchChat]);

  // Theme: sync class on <html> and persist to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await fetchInfo({ data: { input: urlInput } });
      setMessages([]);
      setInfo(data);
      setDialogOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Error al conectar");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    stoppedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setInfo(null);
    setMessages([]);
    continuationRef.current = null;
    setDialogOpen(true);
  };

  const isRead = (id: string) => readStateRef.current.get(id) ?? false;
  const toggleRead = (id: string) => {
    const next = !readStateRef.current.get(id);
    readStateRef.current.set(id, next);
    setReadVersion((v) => v + 1);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const a = authorFilter.trim().toLowerCase();
    return messages.filter((m) => {
      if (hideRead && isRead(m.id)) return false;
      if (onlySuperChat) {
        if (m.type !== "superChatEvent" && m.type !== "superStickerEvent") return false;
      }
      if (onlyMembers && !m.isChatSponsor) return false;
      if (onlyHighlight) {
        const isHL =
          m.isChatOwner ||
          m.isChatModerator ||
          m.isChatSponsor ||
          m.type === "superChatEvent" ||
          m.type === "superStickerEvent";
        if (!isHL) return false;
      }
      if (s && !m.message.toLowerCase().includes(s)) return false;
      if (a && !m.authorName.toLowerCase().includes(a)) return false;
      return true;
    });
  }, [messages, search, authorFilter, onlyHighlight, onlySuperChat, onlyMembers, hideRead, readVersion]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  useEffect(() => {
    if (autoScroll) {
      virtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
    } else {
      virtualizer.scrollToIndex(0, { align: "start" });
    }
  }, [filtered.length, autoScroll, virtualizer]);

  // Keyboard shortcuts (must be after filtered is defined)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Full screen mode active — handle navigation and shortcuts
      if (fullScreenMessage) {
        if (e.key === "Escape" || e.key === "f" || e.key === "F") {
          setFullScreenMessage(null);
          return;
        }
        if (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          toggleRead(fullScreenMessage.id);
          const currentIdx = filtered.findIndex((m) => m.id === fullScreenMessage.id);
          if (currentIdx < filtered.length - 1) {
            setFullScreenMessage(filtered[currentIdx + 1]);
          }
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          const currentIdx = filtered.findIndex((m) => m.id === fullScreenMessage.id);
          if (currentIdx > 0) {
            setFullScreenMessage(filtered[currentIdx - 1]);
          }
          return;
        }
        if (e.key === "l" || e.key === "L") {
          toggleRead(fullScreenMessage.id);
          return;
        }
        if (e.key === "g" || e.key === "G") {
          toast.success("Guardado!");
          return;
        }
        return;
      }

      // Normal mode shortcuts
      if (e.key === "l" || e.key === "L") {
        const target = focusedMessageIdRef.current || hoveredMessageIdRef.current;
        if (target) toggleRead(target);
      }
      if (e.key === "g" || e.key === "G") {
        toast.success("Guardado!");
      }
      if (e.key === "f" || e.key === "F") {
        const targetId = focusedMessageIdRef.current || hoveredMessageIdRef.current;
        if (targetId) {
          const msg = filtered.find((m) => m.id === targetId);
          if (msg) setFullScreenMessage(msg);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleRead, fullScreenMessage, filtered]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip link for keyboard users */}
      <a
        href="#chat-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Saltar al chat
      </a>
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-live live-dot" />
            <h1 className="text-base font-semibold tracking-tight">Live Chat Viewer</h1>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-auto p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            suppressHydrationWarning
          >
            {themeMounted ? (theme === "dark" ? <Sun size={16} /> : <Moon size={16} />) : <span className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors"
          >
            {info ? "Cambiar transmisión" : "Conectar"}
          </button>
          {info && (
            <button
              type="button"
              onClick={disconnect}
              className="text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors"
            >
              Desconectar
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-24">
        {!info ? (
          <section className="mt-12 text-center text-muted-foreground text-sm">
            <p>Pega la URL de una transmisión en vivo para empezar.</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-4 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Pegar URL
            </button>
          </section>
        ) : (
          <section>
            <div className="flex gap-3 items-start rounded-xl bg-card border border-border p-3">
              {info.thumbnail && (
                <img
                  src={info.thumbnail}
                  alt={info.title || "Thumbnail del video"}
                  className="w-20 h-14 object-cover rounded-md flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold leading-snug line-clamp-2">
                  {info.title || info.videoId}
                </h2>
                {info.channelTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{info.channelTitle}</p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                placeholder="Buscar en mensajes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar en mensajes"
                className="col-span-2 rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <input
                placeholder="Filtrar por autor"
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                aria-label="Filtrar por autor"
                className="rounded-lg bg-input border border-border px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <input
                  type="checkbox"
                  checked={onlyHighlight}
                  onChange={(e) => setOnlyHighlight(e.target.checked)}
                  className="accent-primary"
                />
                Solo destacados
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <input
                  type="checkbox"
                  checked={onlySuperChat}
                  onChange={(e) => setOnlySuperChat(e.target.checked)}
                  className="accent-primary"
                />
                Solo Super Chats
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <input
                  type="checkbox"
                  checked={onlyMembers}
                  onChange={(e) => setOnlyMembers(e.target.checked)}
                  className="accent-primary"
                />
                Solo miembros
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <input
                  type="checkbox"
                  checked={hideRead}
                  onChange={(e) => setHideRead(e.target.checked)}
                  className="accent-primary"
                />
                Ocultar leídos
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} mensajes
                {messages.length !== filtered.length && ` (de ${messages.length})`}
              </span>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-primary"
                />
                Auto-scroll
              </label>
            </div>

            <div
              id="chat-content"
              ref={listRef}
              className="mt-2 rounded-xl bg-card border border-border h-[60vh] overflow-y-auto overflow-x-hidden relative p-2"
              style={{ paddingBottom: virtualizer.getTotalSize() }}
              tabIndex={-1}
            >
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">
                  Esperando mensajes...
                </p>
              ) : (
                virtualizer.getVirtualItems().map((item) => {
                  const m = filtered[item.index];
                  return (
                    <div
                      key={m.id}
                      tabIndex={0}
                      role="article"
                      aria-label={`Mensaje de ${m.authorName}`}
                      onMouseEnter={() => { hoveredMessageIdRef.current = m.id; }}
                      onMouseLeave={() => { hoveredMessageIdRef.current = null; }}
                      onFocus={() => { focusedMessageIdRef.current = m.id; }}
                      onBlur={() => { focusedMessageIdRef.current = null; }}
                      className="focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring rounded-lg"
                      style={{
                        position: "absolute",
                        transform: `translateY(${item.start}px)`,
                        height: item.size,
                        width: "100%",
                      }}
                    >
                      <Message
                        m={m}
                        read={isRead(m.id)}
                        toggleRead={toggleRead}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
          </section>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Conectar a una transmisión</DialogTitle>
            <DialogDescription>
              Pega la URL del video en vivo de YouTube. No se requiere API key.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={connect} className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-label="URL del video de YouTube"
              className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            {error && (
              <p role="alert" className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Formatos aceptados:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>https://www.youtube.com/watch?v=VIDEO_ID</li>
                <li>https://youtu.be/VIDEO_ID</li>
                <li>https://www.youtube.com/live/VIDEO_ID</li>
                <li>VIDEO_ID (11 caracteres)</li>
              </ul>
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Conectando..." : "Cargar chat"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts footer */}
      <footer className="fixed bottom-0 inset-x-0 border-t border-border bg-card/80 backdrop-blur z-10">
        <div className="mx-auto max-w-3xl px-4 py-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">L</kbd> Marcar leído</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">G</kbd> Guardado</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">F</kbd> Leer full screen</span>
        </div>
      </footer>

      {/* Full screen reading mode */}
      {fullScreenMessage && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Lectura completa"
        >
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              {fullScreenMessage.authorPhoto && (
                <img
                  src={fullScreenMessage.authorPhoto}
                  alt={fullScreenMessage.authorName}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <span className={`font-semibold ${fullScreenMessage.isChatOwner ? "text-owner" : fullScreenMessage.isChatModerator ? "text-moderator" : fullScreenMessage.isChatSponsor ? "text-sponsor" : "text-foreground"}`}>
                  {fullScreenMessage.authorName}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {fullScreenMessage.isChatOwner && <Badge label="Autor" tone="owner" />}
                  {fullScreenMessage.isChatModerator && <Badge label="Mod" tone="moderator" />}
                  {fullScreenMessage.isChatSponsor && <Badge label="Miembro" tone="sponsor" />}
                  {fullScreenMessage.type === "superChatEvent" && fullScreenMessage.superChatAmount && (
                    <Badge label={`Super Chat ${fullScreenMessage.superChatAmount}`} tone="superchat" />
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFullScreenMessage(null)}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          {/* Message content */}
          <main className="flex-1 flex items-center justify-center px-8 py-12">
            <p className="text-2xl md:text-3xl text-foreground leading-relaxed max-w-2xl text-center">
              {fullScreenMessage.message}
            </p>
          </main>

          {/* Navigation footer */}
          <footer className="px-6 py-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.findIndex((m) => m.id === fullScreenMessage.id) + 1} / {filtered.length}
            </span>
            <div className="flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">Espacio</kbd> Siguiente + leer</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">←</kbd> Anterior</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">L</kbd> Leer</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">G</kbd> Guardar</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">F</kbd> Cerrar</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}


