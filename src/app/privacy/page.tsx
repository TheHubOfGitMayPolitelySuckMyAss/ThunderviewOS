import type { Metadata } from "next";
import PublicNav from "@/components/public-nav";
import { H1, H2, Body, Small } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Privacy Policy — Thunderview CEO Dinners",
  description:
    "How Thunderview CEO Dinners collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <H1 className="mb-4 max-w-[680px]">Privacy policy.</H1>
          <Small className="text-fg4 mb-section">Last updated: June 20, 2026</Small>

          <div className="max-w-[680px] space-y-8">
            <Body>
              This policy explains how Thunderview CEO Dinners — a sole proprietorship
              operated by Eric Marcoullier (&ldquo;Thunderview,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us&rdquo;) — collects, uses, and shares information when you visit our
              website, apply to or attend our dinners, or otherwise interact with us. We
              keep this short and try to only collect what we actually need to run the
              dinners well.
            </Body>

            <div className="space-y-3">
              <H2>Information we collect</H2>
              <Body>
                <strong>Information you give us.</strong> When you apply to a dinner or
                manage your membership, we collect details you provide — such as your
                name, email address, company, role, LinkedIn profile, and anything you
                write in your application or profile. If you pay for a dinner or
                membership, our payment processor collects your payment details; we do
                not store full card numbers ourselves.
              </Body>
              <Body>
                <strong>Information collected automatically.</strong> When you browse the
                site we log basic, first-party usage data — the pages you view, the time
                of the visit, and your browser&rsquo;s user-agent string — so we can
                understand how the site is used. We do not use third-party advertising or
                cross-site tracking.
              </Body>
              <Body>
                <strong>Information from third parties.</strong> If you choose to connect
                a third-party account (for example, LinkedIn), we receive information from
                that service as described in &ldquo;LinkedIn integration&rdquo; below.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>How we use information</H2>
              <Body>We use the information we collect to:</Body>
              <Body as="ul" className="list-disc pl-5 space-y-1.5">
                <li>review applications and decide who to invite to dinners;</li>
                <li>organize dinners and communicate with you about them;</li>
                <li>process payments and memberships;</li>
                <li>send you transactional and occasional update emails;</li>
                <li>operate, secure, and improve the website and our service; and</li>
                <li>comply with legal obligations.</li>
              </Body>
            </div>

            <div className="space-y-3">
              <H2>How we share information</H2>
              <Body>
                We do not sell your personal information. We share it only with the
                service providers that help us run Thunderview, and only as needed for
                them to perform their work:
              </Body>
              <Body as="ul" className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Stripe</strong> — payment processing;
                </li>
                <li>
                  <strong>Resend</strong> — sending email;
                </li>
                <li>
                  <strong>Supabase</strong> — database and file storage;
                </li>
                <li>
                  <strong>Vercel</strong> — website hosting;
                </li>
                <li>
                  <strong>Anthropic</strong> — AI assistance for summarizing applications
                  and drafting communications.
                </li>
              </Body>
              <Body>
                We may also disclose information if required by law, to protect our rights
                or the safety of others, or in connection with a business transfer.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>LinkedIn integration</H2>
              <Body>
                We operate a LinkedIn-connected application. If you authorize it, we
                access your LinkedIn account through LinkedIn&rsquo;s API solely to act on
                your behalf — for example, to read your basic profile and to publish
                content you have created and approved. We only access the data and
                permissions you explicitly grant, we use it only to provide the features
                you asked for, and we do not access other people&rsquo;s accounts. You can
                revoke this access at any time from your LinkedIn settings, and our use of
                LinkedIn data complies with the{" "}
                <a
                  href="https://legal.linkedin.com/api-terms-of-use"
                  className="underline underline-offset-2 hover:text-fg2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn API Terms of Use
                </a>
                .
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Cookies</H2>
              <Body>
                We use essential cookies that are necessary to sign you in and keep you
                logged in to member areas. We do not use advertising or cross-site
                tracking cookies. Most browsers let you block or delete cookies, though
                doing so may prevent you from logging in.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Data retention</H2>
              <Body>
                We keep your information for as long as needed to run the dinners and your
                membership, and as required for legal, accounting, or reporting purposes.
                When information is no longer needed, we delete or anonymize it.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Your rights and choices</H2>
              <Body>
                You can ask us to access, correct, or delete your personal information, or
                to stop emailing you. Every marketing email also includes an unsubscribe
                link. Depending on where you live (for example, California or the European
                Economic Area / United Kingdom), you may have additional rights over your
                personal data; we honor these requests regardless of where you live. To
                make a request, email us at the address below.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Data security</H2>
              <Body>
                We use reasonable technical and organizational measures to protect your
                information. No method of transmission or storage is completely secure, so
                we cannot guarantee absolute security.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Children&rsquo;s privacy</H2>
              <Body>
                Thunderview is intended for business professionals and is not directed to
                anyone under 18. We do not knowingly collect information from children.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Where your data is processed</H2>
              <Body>
                We are based in the United States, and your information is processed here
                and by our service providers. If you access the site from outside the
                United States, you understand your information will be processed in the
                United States.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Changes to this policy</H2>
              <Body>
                We may update this policy from time to time. When we do, we will revise
                the &ldquo;Last updated&rdquo; date above. Material changes will be
                communicated through the site or by email.
              </Body>
            </div>

            <div className="space-y-3">
              <H2>Contact us</H2>
              <Body>
                Questions about this policy or your data? Email{" "}
                <a
                  href="mailto:team@thunderviewceodinners.com"
                  className="underline underline-offset-2 hover:text-fg2"
                >
                  team@thunderviewceodinners.com
                </a>
                , or write to us at 2462 S Acoma St, Denver, CO 80223, United States. This
                policy is governed by the laws of the State of Colorado.
              </Body>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border-subtle py-7 text-center text-[13px] text-fg3">
        Thunderview CEO Dinners
        <span className="text-fg4 mx-2">&middot;</span>
        Denver, Colorado
        <span className="text-fg4 mx-2">&middot;</span>
        team@thunderviewceodinners.com
        <span className="text-fg4 mx-2">&middot;</span>
        <a href="/privacy" className="underline underline-offset-2 hover:text-fg2">
          Privacy
        </a>
      </footer>
    </div>
  );
}
