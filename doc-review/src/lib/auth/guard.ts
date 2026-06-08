import { NextResponse } from 'next/server';
import { getServerSession, type SessionUser } from './session';
import { hasPermission, ForbiddenError, type Action } from '@/lib/permissions';

export async function requireAuth(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) {
    throw new UnauthorizedError('Authentication required');
  }
  return session;
}

export async function requirePermission(action: Action): Promise<SessionUser> {
  const session = await requireAuth();
  if (!hasPermission(session.role, action)) {
    throw new ForbiddenError(`Missing permission: ${action}`);
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: error.message } },
      { status: 401 }
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: error.message } },
      { status: 403 }
    );
  }
  console.error('Unhandled API error:', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  );
}
