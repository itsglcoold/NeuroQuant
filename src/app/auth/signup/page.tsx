import { redirect } from "next/navigation";

// Unified auth: signup and login are the same page
// Magic Link automatically creates accounts for new users
export default function SignupPage() {
  redirect("/auth/login");
}
