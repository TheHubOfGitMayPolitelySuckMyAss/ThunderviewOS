"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const faqs = [
  {
    question: "Who can attend the dinners?",
    answer:
      "Thunderview CEO Dinners are open to startup and bootstrapping CEOs and VCs. The goal is to provide a space for CEOs to build community and help one another.",
  },
  {
    question: "Is this just for tech CEOs?",
    answer:
      "Definitely not! Running a business looks similar across a variety of industries. Whether you\u2019re selling software or books, VR glasses or clothing, you\u2019re likely dealing with capitalization, management, marketing and loads of other common challenges. The only requirement is that you aren\u2019t selling hours (like lawyers, designers, consultants, etc).",
  },
  {
    question: "What if I\u2019m a founder, but not the CEO?",
    answer:
      "Due to size constraints, only CEOs are invited at this time. In the future, we may hold additional events that create opportunities for all founders to connect with one another.",
  },
  {
    question:
      "What if I\u2019m a consultant or service provider to the startup community?",
    answer:
      "Consultants provide an invaluable service to the startup and small business community, providing resources that early-stage companies couldn\u2019t afford full-time. For the time being, though, only CEOs of companies that sell a tangible product or software-based service are invited to attend. First, consultants tend to have a different set of issues and, second, we want our attendees to feel confident that no one is selling them during dinner.",
  },
  {
    question: "Why are VCs invited?",
    answer:
      "That\u2019s a great question! VCs have a unique view across entire markets, and not just from a capital perspective. CEOs typically suffer from survivorship bias \u2014 they\u2019re surrounded by articles about the winners and they don\u2019t get to see how ugly it is, even for those companies that look successful from the outside. VCs can provide a unique level of context for our CEOs and they are warmly welcomed for that purpose.",
  },
  {
    question:
      "What if I\u2019m a CEO who previously sold a startup and now provides consulting services?",
    answer:
      "Dammit! Yes, you can come. Your experience growing and selling a company is powerful and we want you around to guide our less experienced CEOs. Plus, one of them just might inspire you to jump back into company building. Just, please, leave the sales outside of dinner. We\u2019re here to help each other, not canvas for new clients.",
  },
  {
    question: "What\u2019s the deal with Intros and Asks?",
    answer:
      "We\u2019re very intentional about an active community of CEOs who help one another. We send out all attendees\u2019 Intros and Asks the morning of the dinner so that you know who is coming, who you might want to chat with and who you can help. The Monday after each dinner, we circulate the attendees\u2019 Asks via email to the entire community, so even members who weren\u2019t present can still help the community out.",
  },
  {
    question: "How do I purchase a ticket?",
    answer: "LINK_APPLY",
  },
  {
    question: "How do I secure a followup invite?",
    answer:
      "Once you\u2019ve attended a dinner, you\u2019re part of our community. You can buy a ticket any time you\u2019d like to attend a dinner.",
  },
  {
    question: "Why\u2019s the event called Thunderview?",
    answer:
      "Eric\u2019s house in Boulder is on the side of the foothills with a view all the way from Golden to Fort Collins. During the summer, storms roll in from the east and park themselves over Denver, offering regular lightning shows at night, and the house is called Thunderview in the storms\u2019 honor. For many years, Eric held monthly dinners for his clients at Thunderview where they could be part of a larger community of CEOs.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left cursor-pointer"
      >
        <ChevronRight
          size={14}
          className={`text-fg3 flex-shrink-0 transition-transform duration-[120ms] ${open ? "rotate-90" : ""}`}
        />
        <span className="text-[15px] font-medium text-fg1">{question}</span>
      </button>
      {open && (
        <div className="mt-3 pl-[26px]">
          {answer === "LINK_APPLY" ? (
            <p className="text-[14.5px] leading-[1.6] text-fg2">
              <Link
                href="/apply"
                className="font-semibold text-accent-hover underline decoration-border hover:decoration-accent"
              >
                Fill out the application form here.
              </Link>
              {" "}Once we know who you are and what you&rsquo;re working on,
              we&rsquo;ll respond shortly (usually get back same day). When
              you&rsquo;re approved, you get access to the member portal and
              purchase a ticket to the dinner of your choice.
            </p>
          ) : (
            <p className="text-[14.5px] leading-[1.6] text-fg2">{answer}</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function FaqList() {
  return (
    <div className="flex flex-col gap-tight max-w-[780px]">
      {faqs.map((faq) => (
        <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
      ))}
    </div>
  );
}
