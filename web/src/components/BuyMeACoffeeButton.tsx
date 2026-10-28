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
      className="btn btn-primary"
    >
      ☕ Buy Me a Coffee
    </a>
  );
}
