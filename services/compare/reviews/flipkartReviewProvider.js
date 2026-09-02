import { BaseReviewProvider } from "./baseReviewProvider.js";

/**
 * Flipkart review provider.
 *
 * The modern Flipkart product page (React-Native-Web) does not render full
 * review text — but the dedicated `/product-reviews/<itm-id>` page does. We
 * derive that URL from the product URL, then pull the visible review bodies.
 *
 * Each review block on that page looks like:
 *     "4.0•Value-for-money"                     ← rating + one-word verdict
 *     "Review for: Color Teal Green ..."        ← variant (skip)
 *     "<the actual review text>"                ← what we want
 *     "Umesh Gaikwad, Mumbai"                   ← reviewer (skip)
 *     "Helpful for 3211 Verified Purchase ..."  ← meta (skip)
 */
export class FlipkartReviewProvider extends BaseReviewProvider {
  platform = "flipkart";
  allowedHosts = ["flipkart.com"];

  /** BaseReviewProvider navigates to whatever this returns instead of productUrl. */
  reviewsUrl(productUrl) {
    const clean = productUrl.split("?")[0];
    return clean.includes("/p/") ? clean.replace("/p/", "/product-reviews/") : clean;
  }

  async extractReviews(page) {
    await page.waitForTimeout(600);

    return page.evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

      const NAV_NOISE =
        /Login|Sign ?Up|Flipkart Plus|Customer Care|Become a Seller|Gift Cards|Download App|Wishlist|Notification Preferences|One-stop Shopping|wholesale prices/i;
      const META_NOISE =
        /^Review for:|Helpful for|Verified Purchase|Certified Buyer|Permalink|REPORT ABUSE|₹|EMI|Pincode|Delivery|Add to Compare|Specifications/i;

      // Anchor: "<rating>•<verdict>" markers that head each review.
      const markers = Array.from(document.querySelectorAll("div, span")).filter((el) => {
        const t = clean(el.textContent);
        return /^[1-5](\.\d)?\s*[•·]\s*\S/.test(t) && t.length < 60;
      });

      const out = [];
      const seen = new Set();

      for (const marker of markers.slice(0, 30)) {
        let block = marker;
        for (let i = 0; i < 5 && block.parentElement; i += 1) {
          block = block.parentElement;
          if (clean(block.textContent).length > 80) break;
        }

        let best = "";
        for (const node of block.querySelectorAll("div, p, span")) {
          if (node.childElementCount > 0) continue; // leaf text only
          const t = clean(node.textContent).replace(/READ MORE$/i, "").trim();
          if (
            t.length >= 15 &&
            t.length <= 1200 &&
            t.split(" ").length >= 3 &&
            !/^[1-5](\.\d)?\s*[•·]/.test(t) &&
            !META_NOISE.test(t) &&
            !NAV_NOISE.test(t) &&
            t.length > best.length
          ) {
            best = t;
          }
        }
        if (best && !seen.has(best.slice(0, 60))) {
          seen.add(best.slice(0, 60));
          out.push(best);
        }
      }
      return out;
    });
  }
}
