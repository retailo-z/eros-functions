import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const DISCOUNT_TITLE = "Free Gift";
const FREE_GIFT_FUNCTION_HANDLE = "free-gift-discount";

/**
 * Ensures the Free Gift discount is created and active.
 * This runs automatically when the app is loaded.
 */
export async function ensureFreeGiftDiscountExists(admin: AdminApiContext) {
  try {
    // Step 1: Check if discount already exists
    const existingDiscount = await findExistingDiscount(admin);
    
    if (existingDiscount) {
      console.log(`Free Gift discount already exists: ${existingDiscount.id}`);
      return { success: true, discountId: existingDiscount.id, created: false };
    }

    // Step 2: Find the function ID
    const functionId = await findFreeGiftFunctionId(admin);
    
    if (!functionId) {
      console.error("Could not find Free Gift function. Make sure the extension is deployed.");
      return { success: false, error: "Function not found" };
    }

    // Step 3: Create the discount
    const discount = await createFreeGiftDiscount(admin, functionId);
    
    if (discount) {
      console.log(`Free Gift discount created: ${discount.discountId}`);
      return { success: true, discountId: discount.discountId, created: true };
    }

    return { success: false, error: "Failed to create discount" };
  } catch (error) {
    console.error("Error ensuring Free Gift discount exists:", error);
    return { success: false, error: String(error) };
  }
}

async function findExistingDiscount(admin: AdminApiContext) {
  const response = await admin.graphql(`
    query FindFreeGiftDiscount {
      discountNodes(first: 50, query: "title:${DISCOUNT_TITLE}") {
        nodes {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
              status
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const discounts = data.data?.discountNodes?.nodes || [];
  
  // Find an existing Free Gift discount
  return discounts.find((node: any) => 
    node.discount?.title === DISCOUNT_TITLE
  );
}

async function findFreeGiftFunctionId(admin: AdminApiContext) {
  const response = await admin.graphql(`
    query FindFreeGiftFunction {
      shopifyFunctions(first: 25) {
        nodes {
          id
          title
          apiType
          app {
            handle
          }
        }
      }
    }
  `);

  const data = await response.json();
  const functions = data.data?.shopifyFunctions?.nodes || [];
  
  // Find the free-gift-discount function
  const freeGiftFunction = functions.find((fn: any) => 
    fn.apiType === "product_discounts" && 
    fn.app?.handle?.includes(FREE_GIFT_FUNCTION_HANDLE)
  );

  // If not found by handle, try to find by api type (fallback)
  if (!freeGiftFunction) {
    const productDiscountFunction = functions.find((fn: any) => 
      fn.apiType === "product_discounts"
    );
    return productDiscountFunction?.id;
  }

  return freeGiftFunction?.id;
}

async function createFreeGiftDiscount(admin: AdminApiContext, functionId: string) {
  const response = await admin.graphql(`
    mutation CreateFreeGiftDiscount($functionId: String!) {
      discountAutomaticAppCreate(
        automaticAppDiscount: {
          title: "${DISCOUNT_TITLE}"
          functionId: $functionId
          startsAt: "2024-01-01T00:00:00Z"
          combinesWith: {
            orderDiscounts: true
            productDiscounts: true
            shippingDiscounts: true
          }
        }
      ) {
        automaticAppDiscount {
          discountId
          title
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: { functionId }
  });

  const data = await response.json();
  
  if (data.data?.discountAutomaticAppCreate?.userErrors?.length > 0) {
    console.error("Discount creation errors:", data.data.discountAutomaticAppCreate.userErrors);
    return null;
  }

  return data.data?.discountAutomaticAppCreate?.automaticAppDiscount;
}
