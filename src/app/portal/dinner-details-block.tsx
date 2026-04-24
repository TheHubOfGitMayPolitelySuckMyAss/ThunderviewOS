import { ExternalLink, Globe } from "lucide-react";
import { formatName } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Eyebrow } from "@/components/ui/typography";

type Speaker = {
  member_id: string;
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
            <div className="space-y-4 pt-1">
              {details.speakers.map((s) => (
                <div key={s.member_id} className="flex items-start gap-4">
                  <MemberAvatar member={s} size="lg" />
                  <div className="min-w-0 pt-1">
                    <div className="text-base font-medium text-fg1">
                      {formatName(s.first_name, s.last_name)}
                    </div>
                    {s.company_name && (
                      <div className="text-sm text-fg3 mt-0.5">{s.company_name}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {s.linkedin_profile && (
                        <a
                          href={s.linkedin_profile.startsWith("http") ? s.linkedin_profile : `https://${s.linkedin_profile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-fg3 no-underline hover:text-fg1 hover:border-accent transition-colors duration-[120ms]"
                        >
                          <ExternalLink size={12} /> LinkedIn
                        </a>
                      )}
                      {s.company_website && (
                        <a
                          href={s.company_website.startsWith("http") ? s.company_website : `https://${s.company_website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-fg3 no-underline hover:text-fg1 hover:border-accent transition-colors duration-[120ms]"
                        >
                          <Globe size={12} /> Website
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
