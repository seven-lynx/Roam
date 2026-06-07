/**
 * Tests for request proxy middleware (proxy.ts).
 * Verifies: admin route protection, unauthenticated passthrough, error recovery.
 */

describe('Proxy Middleware (proxy)', () => {
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
      // Need to mock next/server first before requiring proxy
      jest.doMock('next/server', () => ({
        NextResponse: {
          next: jest.fn(() => ({ status: 200 })),
          redirect: jest.fn((url: URL) => ({ status: 302, headers: { get: () => url.href } })),
        },
      }));

      const { config } = require('@/proxy');

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

      const { proxy } = require('@/proxy');
      await proxy(mockRequest);

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

      const { proxy } = require('@/proxy');
      await proxy(mockRequest);

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

      const { proxy } = require('@/proxy');
      await proxy(mockRequest);

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

      const { proxy } = require('@/proxy');
      await proxy(mockRequest);

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

      const { proxy } = require('@/proxy');
      await proxy(mockRequest);

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

      const { proxy } = require('@/proxy');
      const result = await proxy(mockRequest);

      expect(result).toBeDefined();
      expect(nextSpy).toHaveBeenCalled();

      nextSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should handle auth.getUser returning an error gracefully', async () => {
      setEnv();

      jest.doMock('@supabase/ssr', () => ({
        createServerClient: jest.fn(() => ({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: { code: 'AUTH_ERROR', status: 500 },
            }),
          },
        })),
      }));

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { NextResponse } = require('next/server');

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

      const { proxy } = require('@/proxy');
      const result = await proxy(mockRequest);

      expect(result).toBeDefined();
      errorSpy.mockRestore();
    });
  });
});