const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export default function MessageText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  const urls = text.match(URL_RE) ?? [];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {urls[i] && (
            <a
              href={urls[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground/60 text-inherit transition-colors"
            >
              {urls[i]}
            </a>
          )}
        </span>
      ))}
    </>
  );
}
