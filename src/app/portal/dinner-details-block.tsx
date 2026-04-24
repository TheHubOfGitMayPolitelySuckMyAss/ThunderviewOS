import { formatName } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Eyebrow } from "@/components/ui/typography";

type Speaker = {
  first_name: string;
  last_name: string;
  company_name: string | null;
  linkedin_profile: string | null;
  company_website: string | null;
  profile_pic_url: string | null;
};

type DinnerDetails = {
  title: string | null;
  description: string | null;
  speakers: Speaker[];
};

export default function DinnerDetailsBlock({ details }: { details: DinnerDetails }) {
  const hasTitle = !!details.title;
  const hasDescription = !!details.description;
  const hasSpeakers = details.speakers.length > 0;
  const hasAnything = hasTitle || hasDescription || hasSpeakers;

  return (
    <div className="mb-6">
      <Eyebrow className="mb-3">Next Dinner</Eyebrow>
      {!hasAnything ? (
        <p className="text-sm text-fg3 italic">Topic and speakers announced soon.</p>
      ) : (
        <div className="space-y-3">
          {hasTitle && (
            <h2 className="font-display font-medium text-xl text-fg1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {details.title}
            </h2>
          )}
          {hasDescription && (
            <p className="text-sm text-fg2 leading-relaxed whitespace-pre-line">{details.description}</p>
          )}
          {hasSpeakers && (
            <div className="space-y-2 pt-1">
              {details.speakers.map((s) => {
                const name = formatName(s.first_name, s.last_name);
                const link = s.linkedin_profile || s.company_website || null;
                const nameEl = link ? (
                  <a
                    href={link.startsWith("http") ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-fg1 hover:text-accent-hover hover:underline"
                  >
                    {name}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-fg1">{name}</span>
                );

                return (
                  <div key={`${s.first_name}-${s.last_name}`} className="flex items-center gap-3">
                    <MemberAvatar member={s} size="md" />
                    <div className="min-w-0">
                      {nameEl}
                      {s.company_name && (
                        <div className="text-xs text-fg3 truncate">{s.company_name}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
