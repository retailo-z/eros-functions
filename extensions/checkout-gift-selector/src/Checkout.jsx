// Checkout Gift Selector - Tiered Threshold System with Discount Exclusion
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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRemovingGifts, setIsRemovingGifts] = useState(false);
  
  // Get settings from shopify.settings.current (subscribable)
  const settings = shopify.settings?.current || {};
  const collectionHandle = settings.gift_collection_handle || "free-gifts";
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
    // Only count code-type discounts (not 'automatic' or 'custom')
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
  // We need this to calculate the percentage
  let totalNonGiftOriginalCost = 0;
  
  cartLines.forEach(line => {
    const isFreeGift = line.attributes?.some(attr => attr.key === FREE_GIFT_KEY && attr.value === "true");
    
    if (!isFreeGift) {
      // Get line cost after all discounts
      const lineCostAfterDiscount = parseFloat(line.cost?.totalAmount?.amount || 0);
      
      // Add back code discounts applied to this line
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
  
  // Map of variant IDs AND product IDs in cart as free gifts -> cart line ID
  const giftVariantsInCart = {};
  const giftProductsInCart = {};
  freeGiftLines.forEach(line => {
    const variantId = line.merchandise?.id;
    const productId = line.merchandise?.product?.id;
    if (variantId) {
      giftVariantsInCart[variantId] = line.id;
    }
    if (productId) {
      giftProductsInCart[productId] = line.id;
    }
  });
  
  // Calculate allowed gifts based on tiered thresholds
  // First gift at $75, then +$25 for each additional
  // $75 = 1 gift, $100 = 2 gifts, $125 = 3 gifts, etc.
  let allowedGifts = 0;
  if (cartTotal >= firstGiftThreshold && !hasLargeDiscount) {
    allowedGifts = 1;
    if (thresholdIncrement > 0) {
      const extraGifts = Math.floor((cartTotal - firstGiftThreshold) / thresholdIncrement);
      allowedGifts = 1 + extraGifts;
    }
  }
  allowedGifts = Math.min(allowedGifts, maxGifts);
  
  // Calculate amount needed for next gift
  let amountForNextGift = 0;
  if (allowedGifts === 0 && !hasLargeDiscount) {
    // Need to reach first threshold
    amountForNextGift = firstGiftThreshold - cartTotal;
  } else if (allowedGifts < maxGifts && !hasLargeDiscount) {
    // Need to reach next tier
    const nextTierThreshold = firstGiftThreshold + (allowedGifts * thresholdIncrement);
    amountForNextGift = nextTierThreshold - cartTotal;
  }
  
  const canAddGift = existingGiftCount < allowedGifts && !hasLargeDiscount;
  const hasReachedMaxTier = allowedGifts >= maxGifts;
  
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
              // Remove entire gift line
              await shopify.applyCartLinesChange({
                type: "removeCartLine",
                id: giftLine.id,
                quantity: lineQty
              });
            } else if (giftsToKeep < lineQty) {
              // Partially reduce this gift line
              await shopify.applyCartLinesChange({
                type: "updateCartLine",
                id: giftLine.id,
                quantity: giftsToKeep
              });
              giftsToKeep = 0;
            } else {
              // Keep this gift line as is
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

  useEffect(() => {
    fetchGiftProducts();
  }, []);

  async function fetchGiftProducts() {
    setLoading(true);
    
    try {
      const query = `
        query getGiftCollection($handle: String!) {
          collection(handle: $handle) {
            products(first: 10) {
              nodes {
                id
                title
                featuredImage {
                  url
                }
                variants(first: 1) {
                  nodes {
                    id
                    price {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const result = await shopify.query(query, {
        variables: { handle: collectionHandle }
      });
      
      if (result?.data?.collection?.products?.nodes) {
        setProducts(result.data.collection.products.nodes);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load gifts");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddGift(product) {
    if (isProcessing || !canAddGift) return;
    
    const variantId = product.variants?.nodes?.[0]?.id;
    if (!variantId) return;
    
    setIsProcessing(true);
    setActionId(product.id);
    
    try {
      const result = await shopify.applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: variantId,
        quantity: 1,
        attributes: [{ key: FREE_GIFT_KEY, value: "true" }]
      });
      
      if (result.type === "error") {
        throw new Error(result.message || "Failed to add gift");
      }
    } catch (err) {
      // Silent fail
    } finally {
      setIsProcessing(false);
      setActionId(null);
    }
  }

  async function handleRemoveGift(product) {
    if (isProcessing) return;
    
    const variantId = product.variants?.nodes?.[0]?.id;
    const cartLineId = giftVariantsInCart[variantId] || giftProductsInCart[product.id];
    
    if (!cartLineId) return;
    
    setIsProcessing(true);
    setActionId(product.id);
    
    try {
      const result = await shopify.applyCartLinesChange({
        type: "removeCartLine",
        id: cartLineId,
        quantity: 1
      });
      
      if (result.type === "error") {
        throw new Error(result.message || "Failed to remove gift");
      }
    } catch (err) {
      // Silent fail
    } finally {
      setIsProcessing(false);
      setActionId(null);
    }
  }

  // Loading state
  if (loading) {
    return h('s-section', null,
      h('s-spinner', { size: 'base' })
    );
  }

  // Error state
  if (error) {
    return h('s-section', null,
      h('s-banner', { tone: 'critical' }, t('error', { message: error }))
    );
  }

      // Large discount applied - free gifts not available
      if (hasLargeDiscount) {
        return h('s-section', null,
          h('s-banner', { tone: 'warning' }, 
            t('discountExclusion', { 
              threshold: Math.round(discountExclusionThreshold)
            })
          )
        );
      }

  // Removing gifts due to discount
  if (isRemovingGifts) {
    return h('s-section', null,
      h('s-stack', { direction: 'block', gap: 'base', alignItems: 'center' },
        h('s-spinner', { size: 'base' }),
        h('s-text', null, t('removingGifts'))
      )
    );
  }

  // No gifts unlocked yet (below first threshold)
  if (allowedGifts === 0) {
    const remaining = amountForNextGift.toFixed(2);
    return h('s-section', null,
      h('s-banner', { tone: 'info' }, t('unlockFirst', { amount: remaining }))
    );
  }

      // No products in collection - don't render anything
      if (products.length === 0) {
        return null;
      }

  // Show gift selector
  return h('s-section', null,
    h('s-stack', { direction: 'block', gap: 'base' },
      h('s-heading', null, t('title')),
      h('s-text', { color: 'subdued' }, t('subtitle', { count: existingGiftCount, max: allowedGifts })),
      
      // Show "unlock next gift" banner if not at max tier
      !hasReachedMaxTier && amountForNextGift > 0 && h('s-banner', { tone: 'info' },
        t('unlockNext', { amount: amountForNextGift.toFixed(2) })
      ),
      
      // Scrollable product list
      h('s-scroll-box', { 
        maxBlockSize: '250px',
        overflow: 'auto hidden'
      },
        h('s-stack', { direction: 'block', gap: 'base' },
          ...products.map(product => {
            const variantId = product.variants?.nodes?.[0]?.id;
            const isInCart = (variantId && giftVariantsInCart[variantId]) || giftProductsInCart[product.id];
            const isCurrentAction = actionId === product.id;
            
            return h('s-stack', { 
              key: product.id,
              direction: 'inline',
              gap: 'base',
              alignItems: 'center',
              padding: 'small'
            },
              // Product thumbnail
              product.featuredImage?.url && h('s-product-thumbnail', {
                src: product.featuredImage.url,
                size: 'small'
              }),
              
              // Product info and button
              h('s-stack', { direction: 'block', gap: 'none' },
                h('s-text', { type: 'strong' }, product.title),
                h('s-text', { color: 'subdued' }, isInCart ? t('inCart') : t('free')),
                
                // Remove or Add button
                isInCart 
                  ? h('s-button', {
                      onClick: () => handleRemoveGift(product),
                      disabled: isProcessing,
                      loading: isCurrentAction,
                      tone: 'critical'
                    }, t('removeButton'))
                  : h('s-button', {
                      onClick: () => handleAddGift(product),
                      disabled: isProcessing || !canAddGift,
                      loading: isCurrentAction
                    }, t('selectButton'))
              )
            );
          })
        )
      )
    )
  );
}
