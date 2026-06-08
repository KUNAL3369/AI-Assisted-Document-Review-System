import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export async function getServerSession(): Promise<SessionUser | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // Refresh session to ensure JWT reflects latest user_metadata (e.g. role promotion)
    await supabase.auth.refreshSession();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    console.log('[getServerSession] user_metadata:', user.user_metadata);

    return {
      id: user.id,
      email: user.email ?? '',
      role: (user.user_metadata?.role as UserRole) ?? 'operations_executive',
    };
  } catch {
    return null;
  }
}
