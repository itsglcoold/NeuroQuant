import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Build the redirect response first so we can attach cookies to it.
    // This is the correct Supabase SSR pattern: cookies must be written
    // onto the response object, not via next/headers, so the browser
    // receives the session cookie in the same request that sets it.
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    // Provide a clear error for common cases (expired link, PKCE mismatch)
    const msg = error.message.toLowerCase().includes("expired")
      ? "Your sign-in link has expired. Please request a new one."
      : "Sign-in failed. Please try again or use Google login.";
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`);
  }

  return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent("Invalid sign-in link. Please request a new one.")}`);
}
