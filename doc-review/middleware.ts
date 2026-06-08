import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isApiRoute = pathname.startsWith('/api');
  const isDashboardRoute = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/upload') ||
    pathname.startsWith('/review') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/logs') ||
    pathname.startsWith('/team') ||
    pathname.startsWith('/settings');

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!user && (isDashboardRoute || isApiRoute)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based page access
  if (user && pathname.startsWith('/team')) {
    const role = user.user_metadata?.role;
    if (role !== 'administrator') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (user && (pathname.startsWith('/logs') || pathname.startsWith('/settings'))) {
    const role = user.user_metadata?.role;
    if (role !== 'administrator' && role !== 'team_lead') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
