function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "owner" | "moderator" | "sponsor" | "superchat";
}) {
  const cls = {
    owner: "bg-owner/20 text-owner border-owner/40",
    moderator: "bg-moderator/20 text-moderator border-moderator/40",
    sponsor: "bg-sponsor/20 text-sponsor border-sponsor/40",
    superchat: "bg-superchat/20 text-superchat border-superchat/40",
  }[tone];
  return (
    <span
      className={`ml-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}
    >
      {label}
    </span>
  );
}

export default Badge;
