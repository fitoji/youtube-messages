import { Eye, EyeOff } from "lucide-react";
import type { ChatMessage } from "@/lib/youtube.functions";
import Badge from "./Badge";

function Message({
  m,
  read,
  toggleRead,
}: {
  m: ChatMessage;
  read: boolean;
  toggleRead: (id: string) => void;
}) {
  const isSuperChat = m.type === "superChatEvent" || m.type === "superStickerEvent";
  const nameColor = m.isChatOwner
    ? "text-owner"
    : m.isChatModerator
    ? "text-moderator"
    : m.isChatSponsor
    ? "text-sponsor"
    : "text-muted-foreground";

  return (
    <div
      className={`group flex gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/40 transition-colors ${
        isSuperChat ? "bg-superchat/15 border border-superchat/40" : ""
      } ${read ? "opacity-50" : ""}`}
    >
      {m.authorPhoto && (
        <img
          src={m.authorPhoto}
          alt=""
          className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <span className={`font-medium ${nameColor}`}>{m.authorName}</span>
        {m.isChatOwner && <Badge label="Autor" tone="owner" />}
        {m.isChatModerator && <Badge label="Mod" tone="moderator" />}
        {m.isChatSponsor && <Badge label="Miembro" tone="sponsor" />}
        {isSuperChat && m.superChatAmount && (
          <Badge label={`Super Chat ${m.superChatAmount}`} tone="superchat" />
        )}
        <span className="mx-1.5 text-foreground/90 break-words">{m.message}</span>
      </div>
      <button
        type="button"
        onClick={() => toggleRead(m.id)}
        title={read ? "Marcar como no leído" : "Marcar como leído"}
        aria-label={read ? "Marcar como no leído" : "Marcar como leído"}
        className={`flex-shrink-0 self-start mt-1 p-1 rounded-md hover:bg-accent transition-opacity ${
          read ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground"
        }`}
      >
        {read ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export default Message;
