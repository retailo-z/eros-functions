// Checkout Gift Selector - Multilanguage UI Extension
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
  
  // Get settings
  const settings = shopify.extension?.settings || {};
  const collectionHandle = settings.gift_collection_handle || "free-gifts";
  const threshold = parseFloat(settings.threshold_amount) || 0;
  const maxGifts = parseInt(settings.max_gifts) || 3;
  
  // Get cart info
  const cartTotal = parseFloat(shopify.cost?.subtotalAmount?.current?.amount || "0");
  const cartLines = shopify.lines?.current || [];
  
  // Get free gift lines in cart
  const freeGiftLines = cartLines.filter(line => 
    line.attributes?.some(attr => attr.key === FREE_GIFT_KEY && attr.value === "true")
  );
  
  // Count total gift quantity
  const existingGiftCount = freeGiftLines.reduce((total, line) => total + (line.quantity || 1), 0);
  
  // Map of variant IDs in cart as free gifts -> cart line ID
  const giftVariantsInCart = {};
  freeGiftLines.forEach(line => {
    const variantId = line.merchandise?.id;
    if (variantId) {
      giftVariantsInCart[variantId] = line.id;
    }
  });
  
  const meetsThreshold = cartTotal >= threshold;
  const canAddGift = existingGiftCount < maxGifts;

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
    const cartLineId = giftVariantsInCart[variantId];
    
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

  // Threshold not met
  if (!meetsThreshold && threshold > 0) {
    const remaining = (threshold - cartTotal).toFixed(2);
    return h('s-section', null,
      h('s-banner', { tone: 'info' }, t('thresholdNotMet', { amount: remaining }))
    );
  }

  // No products
  if (products.length === 0) {
    return h('s-section', null,
      h('s-banner', { tone: 'info' }, t('noGifts'))
    );
  }

  // Show gift selector
  return h('s-section', null,
    h('s-stack', { direction: 'block', gap: 'base' },
      h('s-heading', null, t('title')),
      h('s-text', { color: 'subdued' }, t('subtitle', { count: existingGiftCount, max: maxGifts })),
      
      // Scrollable product list
      h('s-scroll-box', { 
        maxBlockSize: '250px',
        overflow: 'auto hidden'
      },
        h('s-stack', { direction: 'block', gap: 'base' },
          ...products.map(product => {
            const variantId = product.variants?.nodes?.[0]?.id;
            const isInCart = variantId && giftVariantsInCart[variantId];
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
