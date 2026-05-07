import Image from "next/image";
import PublicNav from "@/components/public-nav";
import { H1, H3, Body } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";

const team = [
  {
    name: "Eric Marcoullier",
    title: "Founding Director",
    photo: "/brand/photos/eric.webp",
    photoPosition: "center 30%",
    bio: "Since dropping out of college in 1995, Eric has launched a bunch of tech companies. A few were successful (IGN went public in 2000, MyBlogLog was acquired by Yahoo! in 2007 and Gnip by Twitter in 2014) and most shat the bed. These days, Eric splits his time between coaching early-stage founders on how to survive long enough to get lucky, working with successful businesspeople on how to find fulfillment in their personal lives, and launching the occasional pet technology project. He lives with two amazing teenage sons, two obnoxious dogs and a startlingly patient wife. Hit him up at eric@marcoullier.com.",
  },
  {
    name: "Danny Newman",
    title: "Director",
    photo: "/brand/photos/danny.webp",
    photoPosition: "center 20%",
    bio: "Danny Newman loves Denver. He\u2019s lived here his whole life and is passionate about helping the city grow while making sure we save what makes this city special. Danny now owns My Brother\u2019s Bar and Mercury Cafe. In addition, he started Roximity in 2011 (acquired by Verve in 2016) and now runs Switchboard, a mobile phone answering system for restaurants.",
  },
  {
    name: "Rich Maloy",
    title: "Director",
    photo: "/brand/photos/rich.webp",
    photoPosition: "center 25%",
    bio: "Rich Maloy is a Managing Partner at SpringTime Ventures and whose mission is to rebuild the American dream through entrepreneurship. He respects all people who drive to start up: people who build something out of nothing, create financial independence, and solve problems. He believes this drive is universal and all people everywhere deserve the right to start.",
  },
  {
    name: "Megan Hanson",
    title: "Director",
    photo: "/brand/photos/megan.webp",
    photoPosition: "center 25%",
    bio: "Megan Hanson is a professional communicator with more than a decade of work in public relations, publicity, and copywriting. Her clients span a variety of industries, including real estate, travel & hospitality, technology, startups, non-profits, and beyond. She is a storyteller who helps her clients express their vision and mission to customers and partners. She has extensive experience developing and executing public relations campaigns, securing placements across a variety of mediums including print, digital, television, radio, and podcasts in local, national, and international markets. She has also worked with clients to develop influencer relationships and ambassador programs, as well as craft concise and cohesive brand messaging through blog posts and other marketing materials.",
  },
];

export default function TeamPage() {
  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <H1 className="mb-section">Our team.</H1>

          <div className="flex flex-col gap-stack max-w-[640px] mx-auto">
            {team.map((member) => (
              <Card key={member.name} className="overflow-hidden !p-0">
                <div className="relative aspect-square">
                  <Image
                    src={member.photo}
                    alt={member.name}
                    fill
                    className="object-cover"
                    style={{ objectPosition: member.photoPosition }}
                  />
                </div>
                <div className="p-6 md:p-7">
                  <H3>{member.name}</H3>
                  <p className="text-[15px] text-fg3 mt-1 mb-stack">
                    {member.title}
                  </p>
                  <Body className="max-w-[720px]">{member.bio}</Body>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border-subtle py-7 text-center text-[13px] text-fg3">
        Thunderview CEO Dinners
        <span className="text-fg4 mx-2">&middot;</span>
        Denver, Colorado
        <span className="text-fg4 mx-2">&middot;</span>
        team@thunderviewceodinners.com
      </footer>
    </div>
  );
}
