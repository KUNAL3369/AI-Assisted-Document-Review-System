import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (typeof window === 'undefined') {
      throw new Error(
        'Supabase environment variables are not configured. ' +
        'Create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
    }
    throw new Error(
      'Supabase environment variables are not configured. ' +
      'Check your .env.local file.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
