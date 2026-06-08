import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guard';
import { updateRoleSchema } from '@/lib/validation/schemas';
import { logEvent } from '@/lib/audit/logger';
import type { UserProfile } from '@/lib/types';

export async function GET() {
  try {
    const currentUser = await requirePermission('view_team');
    console.log('[api/team] session.user_metadata:', { id: currentUser.id, role: currentUser.role, email: currentUser.email });
    const adminClient = createAdminClient();

    const { data: users, error } = await adminClient.auth.admin.listUsers();

    if (error) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: error.message } },
        { status: 500 }
      );
    }

    const profiles: UserProfile[] = users.users.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: (u.user_metadata?.role as UserProfile['role']) ?? 'operations_executive',
      created_at: u.created_at ?? '',
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));

    return NextResponse.json({ data: profiles });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requirePermission('manage_users');
    const adminClient = createAdminClient();

    const body = await request.json();
    const parsed = updateRoleSchema.parse(body);

    const { data: targetUser } = await adminClient.auth.admin.getUserById(parsed.user_id);

    if (!targetUser?.user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const oldRole = targetUser.user.user_metadata?.role ?? 'operations_executive';

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      parsed.user_id,
      { user_metadata: { role: parsed.role } }
    );

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: updateError.message } },
        { status: 500 }
      );
    }

    await logEvent({
      event_type: 'user.role_changed',
      user_id: currentUser.id,
      metadata: {
        target_user_id: parsed.user_id,
        old_role: oldRole,
        new_role: parsed.role,
      },
    });

    return NextResponse.json({
      data: { user_id: parsed.user_id, role: parsed.role },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/auth/guard');
    return handleApiError(error);
  }
}
