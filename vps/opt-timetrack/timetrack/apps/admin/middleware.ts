import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = new Set(['/', '/login', '/register', '/forgot-password']);

function isPublicPath(pathname: string) {
  return publicRoutes.has(pathname) || pathname.startsWith('/_next') || pathname === '/favicon.ico';
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('timetrack_session')?.value);

  if (!isPublicPath(pathname) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && hasSession) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
