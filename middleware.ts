import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { updateSession } from "./lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/signup", "/favicon.ico", "/"];

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  const response = await updateSession(request);

  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"))
  ) {
    return response;
  }

  if (pathname.startsWith("/api/usage-export")) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
};

export const config = {
  matcher: ["/app/:path*", "/api/generate", "/api/download-docx"],
};
