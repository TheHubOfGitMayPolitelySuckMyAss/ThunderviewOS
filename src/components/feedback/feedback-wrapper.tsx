import { createClient } from "@/lib/supabase/server";
import FeedbackButton from "./feedback-button";

export default async function FeedbackWrapper() {
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {
    // Auth check failed — show anonymous form
  }

  return <FeedbackButton isAuthenticated={isAuthenticated} />;
}
