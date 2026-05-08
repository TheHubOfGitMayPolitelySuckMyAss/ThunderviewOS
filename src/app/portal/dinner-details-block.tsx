import { ExternalLink, Globe } from "lucide-react";
import { formatName, formatDinnerDisplay } from "@/lib/format";
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
  date: string;
  venue: string;
  address: string;
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
          <div className="text-sm text-fg3 leading-relaxed">
            <div>{formatDinnerDisplay(details.date)} &middot; 6:00 PM</div>
            <div>{details.venue} &middot; {details.address}</div>
          </div>
          {hasDescription && (
            <p className="text-sm text-fg2 leading-relaxed whitespace-pre-line">{details.description}</p>
          )}
          {hasSpeakers && (
            <>
              <h2 className="font-display font-medium text-xl text-fg1 pt-3" style={{ fontVariationSettings: '"opsz" 72' }}>
                Speaking
              </h2>
              <div className="space-y-2 pt-1">
                {details.speakers.map((s) => {
                const name = formatName(s.first_name, s.last_name);
                const hasLinks = s.linkedin_profile || s.company_website;

                return (
                  <div key={s.member_id} className="flex items-center gap-3">
                    <MemberAvatar member={s} size="md" />
                    <div className="min-w-0">
                      <div className="text-sm text-fg1">
                        <span className="font-medium">{name}</span>
                        {s.company_name && (
                          <span className="text-fg3"> &middot; {s.company_name}</span>
                        )}
                      </div>
                      {hasLinks && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {s.linkedin_profile && (
                            <a
                              href={s.linkedin_profile.startsWith("http") ? s.linkedin_profile : `https://${s.linkedin_profile}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-fg3 no-underline hover:text-accent-hover"
                            >
                              <ExternalLink size={11} /> LinkedIn
                            </a>
                          )}
                          {s.linkedin_profile && s.company_website && (
                            <span className="text-fg4 text-xs">&middot;</span>
                          )}
                          {s.company_website && (
                            <a
                              href={s.company_website.startsWith("http") ? s.company_website : `https://${s.company_website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-fg3 no-underline hover:text-accent-hover"
                            >
                              <Globe size={11} /> Website
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
