import Link from 'next/link';
import Image from 'next/image';
import FeedbackWidget from './FeedbackWidget';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-zinc-900 dark:text-white mb-2">
              <Image src="/icon-512.png" alt="Roam" width={24} height={24} />
              Roam
            </Link>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Discover a random corner of the web. Curated by the community, personalized to your taste.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Product</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/how-it-works" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/collections" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Collections
                </Link>
              </li>
              <li>
                <Link href="/submit" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Submit a URL
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          {/* Download */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Get the App</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Chrome Extension
                </a>
              </li>
              <li>
                <a
                  href="https://addons.mozilla.org/firefox/addon/roam-the-web/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Firefox Add-on
                </a>
              </li>
              <li>
                <Link href="/android-beta" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Android App
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Legal</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/privacy" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@roamtheweb.app"
                  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <span>© {year} Roam. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/seven-lynx/Roam"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <FeedbackWidget />
          </div>
        </div>
      </div>
    </footer>
  );
}