import { BUY_ME_A_COFFEE_URL } from "@/lib/constants";

/**
 * Prominent "Buy Me a Coffee" tip button, linking out to the support page.
 */
export function BuyMeACoffeeButton() {
  return (
    <a
      href={BUY_ME_A_COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 px-8 py-3 text-white font-semibold text-base transition-colors"
    >
      ☕ Buy Me a Coffee
    </a>
  );
}
