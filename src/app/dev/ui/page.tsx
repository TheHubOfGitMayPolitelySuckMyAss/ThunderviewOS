/**
 * Dev-only UI primitive showcase.
 *
 * Route: /dev/ui (underscore prefix excludes from prod navigation).
 * Not linked from any page. Visit manually during development.
 */

import { ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Card,
  Pill,
  Input,
  Textarea,
  Select,
  Label,
  FieldHelp,
  Eyebrow,
  H1,
  H2,
  H3,
  H4,
  Lede,
  Body,
  Small,
} from "@/components/ui";
import MemberAvatar from "@/components/member-avatar";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="tv-h3 mb-4 pb-2 border-b border-border">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="tv-eyebrow mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function DevUIPage() {
  const member = { first_name: "Eric", last_name: "Marcoullier", profile_pic_url: null };
  const memberWithPic = {
    first_name: "Sasha",
    last_name: "Patel",
    profile_pic_url: "/brand/photos/dinner-07-candid-smile.webp",
  };

  return (
    <div className="tv-surface min-h-screen">
      <div className="tv-container-marketing tv-page-gutter py-12">
        <H1 className="mb-2">UI Primitives</H1>
        <Lede className="mb-10">Dev-only showcase. Every primitive in every relevant state.</Lede>

        {/* ---- BUTTONS ---- */}
        <Section title="Button">
          <Row label="Primary">
            <Button>Buy A Dinner Ticket</Button>
            <Button size="sm">Save</Button>
            <Button size="lg">Apply To Attend</Button>
            <Button disabled>Submitting…</Button>
          </Row>
          <Row label="Primary with icon">
            <Button><Plus size={16} className="mr-1.5" />Add Member</Button>
            <Button size="sm"><Check size={16} className="mr-1" />Done</Button>
          </Row>
          <Row label="Secondary">
            <Button variant="secondary">View The Community</Button>
            <Button variant="secondary" size="sm">Sort: Name</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </Row>
          <Row label="Ghost">
            <Button variant="ghost">Cancel</Button>
            <Button variant="ghost" size="sm">Skip</Button>
          </Row>
          <Row label="Danger (secondary + color override)">
            <Button variant="secondary" className="!text-ember-600 !border-ember-600/30 hover:!bg-ember-600/[0.08]">
              <Trash2 size={16} className="mr-1.5" />Reject…
            </Button>
          </Row>
        </Section>

        {/* ---- CARDS ---- */}
        <Section title="Card">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <Eyebrow>Default</Eyebrow>
              <H3 className="mt-1.5 mb-1">A standard card</H3>
              <Body>Cream surface, warm border, subtle shadow.</Body>
            </Card>
            <Card variant="elevated">
              <Eyebrow>Elevated</Eyebrow>
              <H3 className="mt-1.5 mb-1">Medium shadow</H3>
              <Body>Lifts a step above default.</Body>
            </Card>
            <Card variant="feature">
              <Eyebrow className="!text-clay-600">Feature</Eyebrow>
              <H3 className="mt-1.5 mb-1">Candle-glow shadow</H3>
              <Body>One per screen max.</Body>
            </Card>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card
              variant="photo"
              photoSrc="/brand/photos/dinner-01-conversation.webp"
              photoAlt="Two CEOs chatting"
            >
              <Eyebrow>Dinner #36 · May</Eyebrow>
              <H3 className="mt-1.5 mb-1">Photo card</H3>
              <Small>Photo fills top, text in cream band below.</Small>
            </Card>
            <Card
              variant="photo"
              photoSrc="/brand/photos/dinner-05-panel-audience.webp"
              photoAlt="Audience laughing"
              photoPosition="center 40%"
            >
              <Eyebrow>Dinner #35 · April</Eyebrow>
              <H3 className="mt-1.5 mb-1">Custom position</H3>
              <Small>Photo position can be adjusted.</Small>
            </Card>
          </div>
        </Section>

        {/* ---- PILLS ---- */}
        <Section title="Pill">
          <Row label="Status pills (with dot)">
            <Pill variant="success" dot>Approved</Pill>
            <Pill variant="warn" dot>Pending</Pill>
            <Pill variant="danger" dot>Rejected</Pill>
          </Row>
          <Row label="Label pills (no dot)">
            <Pill variant="neutral">Fulfilled</Pill>
            <Pill variant="accent">New</Pill>
            <Pill variant="stage">Active CEO</Pill>
            <Pill variant="stage">Investor</Pill>
            <Pill variant="stage">Exited CEO</Pill>
          </Row>
        </Section>

        {/* ---- AVATAR ---- */}
        <Section title="Avatar">
          <Row label="Sizes (initials)">
            <MemberAvatar member={member} size="sm" />
            <MemberAvatar member={member} size="md" />
            <MemberAvatar member={member} size="lg" />
          </Row>
          <Row label="With photo">
            <MemberAvatar member={memberWithPic} size="sm" />
            <MemberAvatar member={memberWithPic} size="md" />
            <MemberAvatar member={memberWithPic} size="lg" />
          </Row>
        </Section>

        {/* ---- FORM CONTROLS ---- */}
        <Section title="Form controls">
          <div className="max-w-[420px] space-y-4">
            <div>
              <Label required>Email</Label>
              <Input placeholder="you@company.com" defaultValue="jane@company.com" />
            </div>
            <div>
              <Label>Company website</Label>
              <Input placeholder="https://" />
              <FieldHelp>Include the full URL.</FieldHelp>
            </div>
            <div>
              <Label required>LinkedIn profile</Label>
              <Input error defaultValue="not-a-url" />
              <FieldHelp error>Please enter a full LinkedIn URL.</FieldHelp>
            </div>
            <div>
              <Label>Disabled</Label>
              <Input disabled defaultValue="can't touch this" />
            </div>
            <div>
              <Label>Intro</Label>
              <Textarea defaultValue="Founder / CEO of Clearwater Build. We help construction ops teams replace spreadsheets with something that doesn't catch fire." />
            </div>
            <div>
              <Label>Attendee stage/type</Label>
              <Select>
                <option>Active CEO (Bootstrapping or VC-Backed)</option>
                <option>Exited CEO (Acquisition or IPO)</option>
                <option>Investor</option>
                <option>Guest (Speaker/Press/Etc)</option>
              </Select>
            </div>
            <div>
              <Label>Preferred contact</Label>
              <Select>
                <option>LinkedIn</option>
                <option>Email</option>
              </Select>
            </div>
          </div>
        </Section>

        {/* ---- TYPOGRAPHY ---- */}
        <Section title="Typography">
          <div className="space-y-4">
            <Eyebrow>Eyebrow — uppercase, wide tracking</Eyebrow>
            <H1>H1 — Fraunces display, 40–64px</H1>
            <H2>H2 — Fraunces display, 30–48px</H2>
            <H3>H3 — Fraunces display, 28px</H3>
            <H4>H4 — Inter semibold, 22px</H4>
            <Lede>Lede — 18px body intro paragraph. Used under page headings for context.</Lede>
            <Body>Body — 16px reading text. The default paragraph style throughout the app. Designed for comfortable reading at any width.</Body>
            <Small>Small — 14px secondary text for meta info, captions, and helper copy.</Small>
          </div>
        </Section>

        {/* ---- ICONS ---- */}
        <Section title="Icons (Lucide)">
          <Row label="16px inline (buttons)">
            <span className="inline-flex items-center gap-1.5 text-fg2 text-sm">
              <Plus size={16} /> Add
            </span>
            <span className="inline-flex items-center gap-1.5 text-fg2 text-sm">
              <Check size={16} /> Done
            </span>
            <span className="inline-flex items-center gap-1.5 text-fg2 text-sm">
              <X size={16} /> Close
            </span>
          </Row>
          <Row label="20px nav">
            <ArrowRight size={20} className="text-fg3" />
            <Plus size={20} className="text-fg3" />
            <Trash2 size={20} className="text-fg3" />
          </Row>
          <Row label="24px standalone">
            <ArrowRight size={24} className="text-fg2" />
            <Plus size={24} className="text-fg2" />
            <Check size={24} className="text-fg2" />
          </Row>
        </Section>
      </div>
    </div>
  );
}
