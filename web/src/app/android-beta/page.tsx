import { redirect } from "next/navigation";

// The Android app is now released on Google Play. The old closed-beta
// waitlist has been retired in favor of the app landing page.
export default function AndroidBetaPage() {
  redirect("/android");
}
