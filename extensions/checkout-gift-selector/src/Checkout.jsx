// Checkout Free Gift Enforcer - Eligibility & Auto-Removal (No UI Selector)
// Products with _free_gift: true are added before checkout (e.g. via cart drawer/theme).
// This extension enforces eligibility rules and auto-removes gifts when not qualified.
import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const FREE_GIFT_KEY = "_free_gift";

// Helper function to get translations
function t(key, replacements = {}) {
  try {
    return shopify.i18n.translate(key, replacements);
  } catch (err) {
    return key;
  }
}

export default async function() {
  try {
    render(h(Extension, {}), document.body);
  } catch (err) {
    // Silent fail
  }
}

function Extension() {
  const [isRemovingGifts, setIsRemovingGifts] = useState(false);
  
  // Get settings from shopify.settings.current (subscribable)
  const settings = shopify.settings?.current || {};
  const firstGiftThreshold = parseFloat(settings.first_gift_threshold) || 75;
  const thresholdIncrement = parseFloat(settings.threshold_increment) || 25;
  const maxGifts = parseInt(settings.max_gifts) || 3;
  const discountExclusionThreshold = parseFloat(settings.discount_exclusion_threshold) || 40;
  
  // Get cart info
  const cartLines = shopify.lines?.current || [];
  const cartTotal = parseFloat(shopify.cost?.subtotalAmount?.current?.amount || "0");
  
  // Get cart-level discount allocations (this includes order-level discounts)
  const cartDiscountAllocations = shopify.discountAllocations?.current || [];
  
  // Calculate total discount from DISCOUNT CODES only (type === 'code')
  // This excludes automatic discounts like the free gift discount
  let totalCodeDiscountAmount = 0;
  
  cartDiscountAllocations.forEach(allocation => {
    if (allocation.type === 'code') {
      totalCodeDiscountAmount += parseFloat(allocation.discountedAmount?.amount || 0);
    }
  });
  
  // Also check line-level discount allocations (some codes apply at line level)
  cartLines.forEach(line => {
    const isFreeGift = line.attributes?.some(attr => attr.key === FREE_GIFT_KEY && attr.value === "true");
    
    if (!isFreeGift && line.discountAllocations) {
      line.discountAllocations.forEach(allocation => {
        if (allocation.type === 'code') {
          totalCodeDiscountAmount += parseFloat(allocation.discountedAmount?.amount || 0);
        }
      });
    }
  });
  
  // Calculate original cart value for non-gift items (before code discounts)
  let totalNonGiftOriginalCost = 0;
  
  cartLines.forEach(line => {
    const isFreeGift = line.attributes?.some(attr => attr.key === FREE_GIFT_KEY && attr.value === "true");
    
    if (!isFreeGift) {
      const lineCostAfterDiscount = parseFloat(line.cost?.totalAmount?.amount || 0);
      
      const lineCodeDiscount = (line.discountAllocations || [])
        .filter(allocation => allocation.type === 'code')
        .reduce((sum, allocation) => sum + parseFloat(allocation.discountedAmount?.amount || 0), 0);
      
      totalNonGiftOriginalCost += lineCostAfterDiscount + lineCodeDiscount;
    }
  });
  
  // If no line-level calculation worked, use cart subtotal + code discount
  if (totalNonGiftOriginalCost === 0) {
    totalNonGiftOriginalCost = cartTotal + totalCodeDiscountAmount;
  }
  
  // Calculate the code discount percentage
  const discountPercentage = totalNonGiftOriginalCost > 0 
    ? (totalCodeDiscountAmount / totalNonGiftOriginalCost) * 100 
    : 0;
  
  // Check if discount code is too large (≥ threshold, default 40%)
  const hasLargeDiscount = discountPercentage >= discountExclusionThreshold;
  
  // Get free gift lines in cart
  const freeGiftLines = cartLines.filter(line => 
    line.attributes?.some(attr => attr.key === FREE_GIFT_KEY && attr.value === "true")
  );
  
  // Count total gift quantity
  const existingGiftCount = freeGiftLines.reduce((total, line) => total + (line.quantity || 1), 0);
  
  // Calculate allowed gifts based on tiered thresholds
  let allowedGifts = 0;
  if (cartTotal >= firstGiftThreshold && !hasLargeDiscount) {
    allowedGifts = 1;
    if (thresholdIncrement > 0) {
      const extraGifts = Math.floor((cartTotal - firstGiftThreshold) / thresholdIncrement);
      allowedGifts = 1 + extraGifts;
    }
  }
  allowedGifts = Math.min(allowedGifts, maxGifts);
  
  // Auto-remove excess free gifts when cart no longer qualifies:
  // - Products removed from cart → total drops below threshold
  // - Cart drops to a lower tier → fewer gifts allowed than currently in cart
  // - Large discount code applied → allowedGifts becomes 0
  useEffect(() => {
    async function removeExcessGifts() {
      if (existingGiftCount > allowedGifts && freeGiftLines.length > 0 && !isRemovingGifts) {
        setIsRemovingGifts(true);
        
        try {
          let giftsToKeep = allowedGifts;
          
          for (const giftLine of freeGiftLines) {
            const lineQty = giftLine.quantity || 1;
            
            if (giftsToKeep <= 0) {
              await shopify.applyCartLinesChange({
                type: "removeCartLine",
                id: giftLine.id,
                quantity: lineQty
              });
            } else if (giftsToKeep < lineQty) {
              await shopify.applyCartLinesChange({
                type: "updateCartLine",
                id: giftLine.id,
                quantity: giftsToKeep
              });
              giftsToKeep = 0;
            } else {
              giftsToKeep -= lineQty;
            }
          }
        } catch (err) {
          // Silent fail
        } finally {
          setIsRemovingGifts(false);
        }
      }
    }
    
    removeExcessGifts();
  }, [existingGiftCount, allowedGifts]);

  // Show a brief message only while actively removing gifts
  if (isRemovingGifts) {
    return h('s-section', null,
      h('s-stack', { direction: 'block', gap: 'base', alignItems: 'center' },
        h('s-spinner', { size: 'base' }),
        h('s-text', null, t('removingGifts'))
      )
    );
  }

  // Otherwise render nothing — this extension works silently in the background
  return null;
}
