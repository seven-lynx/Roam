/**
 * Jest setup file for Roam web platform.
 * Runs before each test suite.
 */

// Next.js 16 server components need the native Request class in scope.
// jsdom does not provide it, so supply a minimal polyfill.
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input) {
      this.url = typeof input === 'string' ? input : input?.url ?? ''
    }
  }
}

// Mock Sentry for tests (prevent noise in test output)
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  startTransaction: jest.fn(() => ({
    end: jest.fn(),
  })),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock next/link — Next 16's Link uses the compiled React runtime, which has no
// active dispatcher in jsdom tests, so rendering it throws
// "Cannot read properties of null (reading 'useContext')". Render a plain <a>.
jest.mock('next/link', () => {
  const React = require('react');
  const MockLink = React.forwardRef(function MockLink({ href, children, ...rest }, ref) {
    const hrefString = typeof href === 'string' ? href : href?.pathname || '#';
    return React.createElement('a', { href: hrefString, ref, ...rest }, children);
  });
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
})

// Mock Supabase. `createClient` stays a stub (tests never touch the network), but the
// real auth-error helpers are kept: middleware has to tell an anonymous visitor
// (AuthSessionMissingError — returned, not thrown) from a genuine auth failure.
jest.mock('@supabase/supabase-js', () => {
  const actual = jest.requireActual('@supabase/supabase-js');
  return {
    createClient: jest.fn(),
    isAuthSessionMissingError: actual.isAuthSessionMissingError,
    AuthSessionMissingError: actual.AuthSessionMissingError,
    AuthApiError: actual.AuthApiError,
  }
})

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({ auth: {}, from: jest.fn() })),
}))

// Suppress console output during tests (unless explicitly enabled)
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: useLayoutEffect does nothing on the server')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})