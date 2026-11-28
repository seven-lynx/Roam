import { alt, contentType, size } from '@/app/opengraph-image';

// The route is a build-time `next/og` card. Its metadata is the contract worth
// guarding: ImageResponse itself needs the satori/font stack that jsdom lacks, so
// the constructor is all this file needs to stand in for.
jest.mock('next/og', () => ({
  ImageResponse: class {
    readonly element: unknown;
    readonly options: unknown;

    constructor(element: unknown, options: unknown) {
      this.element = element;
      this.options = options;
    }
  },
}));

describe('opengraph image route', () => {
  it('declares the dimensions and type Next reads from the file convention', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
  });

  it('keeps a non-empty alt, which is what link previews and screen readers use', () => {
    expect(typeof alt).toBe('string');
    expect(alt).toMatch(/roam/i);
  });
});
