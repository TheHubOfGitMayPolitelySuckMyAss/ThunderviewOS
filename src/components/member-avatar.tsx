import Image from "next/image";

const SIZES = {
  sm: { container: "h-7 w-7", text: "text-[10px]", px: 28 },
  md: { container: "h-10 w-10", text: "text-xs", px: 40 },
  lg: { container: "h-[120px] w-[120px]", text: "text-3xl", px: 120 },
} as const;

type MemberAvatarProps = {
  member: {
    first_name: string;
    last_name: string;
    profile_pic_url?: string | null;
  };
  size: "sm" | "md" | "lg";
};

export default function MemberAvatar({ member, size }: MemberAvatarProps) {
  const s = SIZES[size];
  const firstInitial = member.first_name?.[0]?.toUpperCase() ?? "?";
  const lastInitial = member.last_name?.[0]?.toUpperCase() ?? "";
  const initials = firstInitial + lastInitial;

  if (member.profile_pic_url) {
    return (
      <Image
        src={member.profile_pic_url}
        alt={initials}
        width={s.px}
        height={s.px}
        className={`${s.container} rounded-full object-cover`}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${s.container} flex items-center justify-center rounded-full bg-accent font-medium text-cream-50 ${s.text}`}
    >
      {initials}
    </div>
  );
}
