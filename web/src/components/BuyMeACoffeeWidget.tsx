import { BUY_ME_A_COFFEE_USERNAME } from '@/lib/constants';

const WIDGET_SCRIPT_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';

/**
 * Buy Me a Coffee's official floating tip widget.
 *
 * This must be rendered as a plain, synchronous <script> in the initial HTML.
 * The widget registers a DOMContentLoaded listener, so injecting it after
 * hydration (e.g. from a useEffect) runs too late and the button never appears.
 */
export function BuyMeACoffeeWidget() {
  return ( // eslint-disable-next-line @next/next/no-sync-scripts -- synchronous load is required before DOMContentLoaded
    <script
      data-name="BMC-Widget"
      data-cfasync="false"
      src={WIDGET_SCRIPT_SRC}
      data-id={BUY_ME_A_COFFEE_USERNAME}
      data-description="Support me on Buy me a coffee!"
      data-message="Thank you for contributing!"
      data-color="#40DCA5"
      data-position="Right"
      data-x_margin="18"
      data-y_margin="18"
    />
  );
}