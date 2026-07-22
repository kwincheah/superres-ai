import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function getSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function isServerComponentCookieWriteError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Cookies can only be modified in a Server Action or Route Handler") ||
    error.message.includes("ReadonlyRequestCookies cannot be modified")
  );
}

type ServerSupabaseClient = ReturnType<typeof createServerClient<Database>>;
type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieSetOptions = Parameters<CookieStore["set"]>[2];

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieSetOptions;
}

export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            if (options) {
              cookieStore.set(name, value, options);
            } else {
              cookieStore.set(name, value);
            }
          } catch (error) {
            if (isServerComponentCookieWriteError(error)) {
              // In Server Components, cookie writes are blocked by Next.js.
              return;
            }
            throw error;
          }
        }
      },
    },
  });
}