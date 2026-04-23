import { NextResponse } from "next/server";
import { sendNewApplicationNotification } from "@/lib/email-send";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("key") !== "thunderview-test-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await sendNewApplicationNotification({
      id: "test-preview-id",
      firstName: "Eric",
      lastName: "Marcoullier",
      email: "eric@marcoullier.com",
      companyName: "Thunderview",
      companyWebsite: "thunderviewceodinners.com",
      linkedinProfile: "linkedin.com/in/marcoullier",
      attendeeStagetype: "Active CEO (Bootstrapping or VC-Backed)",
    });
    return NextResponse.json({ result: "sent" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
