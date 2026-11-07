/**
 * Tests for request middleware (middleware.ts).
 * Verifies: admin route protection, unauthenticated passthrough, error recovery.
 */

describe('Middleware', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setEnv() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-123';
  }

  // ─── matcher config ──────────────────────────────────────────────────────────

  describe('config.matcher', () => {
    it('should exclude static files and Next.js internals', () => {
      // Need to mock next/server first before requiring middleware
      jest.doMock('next/server', () => ({
        NextResponse: {
          next: jest.fn(() => ({ status: 200 })),
          redirect: jest.fn((url: URL) => ({ status: 302, headers: { get: () => url.href } })),
        },
      }));

      const { config } = require('@/middleware');

      expect(Array.isArray(config.matcher)).toBe(true);

      const matcher = config.matcher[0];
      expect(typeof matcher).toBe('string');

      // Should exclude _next/static, _next/image, favicon, static assets
      expect(matcher).toContain('_next/static');
      expect(matcher).toContain('_next/image');
      expect(matcher).toContain('favicon.ico');
      expect(matcher).toContain('svg');
      expect(matcher).toContain('png');
    });
  });

  // ─── admin route protection ──────────────────────────────────────────────────

  describe('admin route protection', () => {
    it('should redirect unauthenticated users from /admin to /', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        })),
      }));

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');

      const mockRequest = {
        nextUrl: {
          pathname: '/admin',
          href: 'http://localhost:3000/admin',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/admin',
      };

      const { middleware } = require('@/middleware');
      await middleware(mockRequest);

      expect(redirectSpy).toHaveBeenCalled();
      const redirectArg = redirectSpy.mock.calls[0][0] as URL;
      expect(redirectArg.href).toContain('/');

      redirectSpy.mockRestore();
    });

    it('should redirect non-admin authenticated users from /admin to /', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: {
                user: {
                  id: 'user-1',
                  app_metadata: { role: 'user' },
                },
              },
              error: null,
            }),
          },
        })),
      }));

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');

      const mockRequest = {
        nextUrl: {
          pathname: '/admin',
          href: 'http://localhost:3000/admin',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/admin',
      };

      const { middleware } = require('@/middleware');
      await middleware(mockRequest);

      expect(redirectSpy).toHaveBeenCalled();
      redirectSpy.mockRestore();
    });

    it('should allow admin users to access /admin', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: {
                user: {
                  id: 'admin-1',
                  app_metadata: { role: 'admin' },
                },
              },
              error: null,
            }),
          },
        })),
      }));

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');

      const mockRequest = {
        nextUrl: {
          pathname: '/admin',
          href: 'http://localhost:3000/admin',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/admin',
      };

      const { middleware } = require('@/middleware');
      await middleware(mockRequest);

      expect(redirectSpy).not.toHaveBeenCalled();
      redirectSpy.mockRestore();
    });
  });

  // ─── public route passthrough ────────────────────────────────────────────────

  describe('public route passthrough', () => {
    it('should allow unauthenticated users to access /', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        })),
      }));

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');

      const mockRequest = {
        nextUrl: {
          pathname: '/',
          href: 'http://localhost:3000/',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/',
      };

      const { middleware } = require('@/middleware');
      await middleware(mockRequest);

      expect(redirectSpy).not.toHaveBeenCalled();
      redirectSpy.mockRestore();
    });

    it('should allow unauthenticated users to access /join', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        })),
      }));

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');

      const mockRequest = {
        nextUrl: {
          pathname: '/join',
          href: 'http://localhost:3000/join',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/join',
      };

      const { middleware } = require('@/middleware');
      await middleware(mockRequest);

      expect(redirectSpy).not.toHaveBeenCalled();
      redirectSpy.mockRestore();
    });
  });

  // ─── error recovery ──────────────────────────────────────────────────────────

  describe('error recovery', () => {
    it('should return NextResponse.next() even when getUser throws', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockRejectedValue(new Error('Network error')),
          },
        })),
      }));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { NextResponse } = require('next/server');
      const nextSpy = jest.spyOn(NextResponse, 'next');

      const mockRequest = {
        nextUrl: {
          pathname: '/profile',
          href: 'http://localhost:3000/profile',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/profile',
      };

      const { middleware } = require('@/middleware');
      const result = await middleware(mockRequest);

      expect(result).toBeDefined();
      expect(nextSpy).toHaveBeenCalled();

      nextSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should treat a missing session as anonymous traffic, not an error (issue #55)', async () => {
      setEnv();

      const { AuthSessionMissingError } = require('@supabase/supabase-js');

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            // auth-js RETURNS this (it does not throw) when the visitor carries no
            // session cookie — the normal state for anonymous traffic.
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: new AuthSessionMissingError(),
            }),
          },
        })),
      }));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { NextResponse } = require('next/server');
      const redirectSpy = jest.spyOn(NextResponse, 'redirect');
      const nextSpy = jest.spyOn(NextResponse, 'next');

      const publicRequest = {
        nextUrl: { pathname: '/', href: 'http://localhost:3000/' },
        cookies: { getAll: jest.fn().mockReturnValue([]), set: jest.fn() },
        url: 'http://localhost:3000/',
      };
      const protectedRequest = {
        nextUrl: { pathname: '/profile', href: 'http://localhost:3000/profile' },
        cookies: { getAll: jest.fn().mockReturnValue([]), set: jest.fn() },
        url: 'http://localhost:3000/profile',
      };

      const { middleware } = require('@/middleware');
      const publicResult = await middleware(publicRequest);

      // No Sentry error per anonymous page view.
      expect(errorSpy).not.toHaveBeenCalled();
      expect(publicResult).toBeDefined();
      expect(redirectSpy).not.toHaveBeenCalled();
      expect(nextSpy).toHaveBeenCalled();

      // Protection still applies to anonymous visitors.
      await middleware(protectedRequest);
      expect(redirectSpy).toHaveBeenCalled();

      nextSpy.mockRestore();
      redirectSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should report a genuine auth failure with identifying context', async () => {
      setEnv();

      const { AuthApiError } = require('@supabase/supabase-js');

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: new AuthApiError('invalid JWT', 403, 'bad_jwt'),
            }),
          },
        })),
      }));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockRequest = {
        nextUrl: {
          pathname: '/',
          href: 'http://localhost:3000/',
        },
        cookies: {
          getAll: jest.fn().mockReturnValue([]),
          set: jest.fn(),
        },
        url: 'http://localhost:3000/',
      };

      const { middleware } = require('@/middleware');
      const result = await middleware(mockRequest);

      expect(result).toBeDefined();
      expect(errorSpy).toHaveBeenCalled();

      // Context survives sanitizeContext, so the Sentry event can be diagnosed.
      const context = errorSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(context).toEqual({
        reason: 'AuthApiError',
        errorCode: 'bad_jwt',
        errorStatus: 403,
      });

      errorSpy.mockRestore();
    });
  });
});