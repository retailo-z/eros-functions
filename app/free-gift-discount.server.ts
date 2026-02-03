import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const DISCOUNT_TITLE = "Free Gift";
const FREE_GIFT_FUNCTION_HANDLE = "free-gift-discount";

/**
 * Gets the current status of the Free Gift discount
 */
export async function getFreeGiftDiscountStatus(admin: AdminApiContext) {
  try {
    const existingDiscount = await findExistingDiscount(admin);
    
    if (existingDiscount) {
      return {
        exists: true,
        discountId: existingDiscount.id,
        isActive: existingDiscount.discount?.status === "ACTIVE",
        status: existingDiscount.discount?.status,
      };
    }
    
    return { exists: false, isActive: false };
  } catch (error) {
    console.error("Error getting discount status:", error);
    return { exists: false, isActive: false, error: String(error) };
  }
}

/**
 * Toggles the Free Gift discount on/off
 */
export async function toggleFreeGiftDiscount(admin: AdminApiContext, enable: boolean) {
  try {
    const existingDiscount = await findExistingDiscount(admin);
    
    if (!existingDiscount) {
      return { success: false, error: "Discount not found" };
    }

    const response = await admin.graphql(`
      mutation UpdateDiscountStatus($id: ID!) {
        discountAutomaticActivate(id: $id) @include(if: ${enable})
        discountAutomaticDeactivate(id: $id) @skip(if: ${enable})
      }
    `, {
      variables: { id: existingDiscount.id }
    });

    // Use the correct mutation based on enable flag
    const mutation = enable ? `
      mutation ActivateDiscount($id: ID!) {
        discountAutomaticActivate(id: $id) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                status
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    ` : `
      mutation DeactivateDiscount($id: ID!) {
        discountAutomaticDeactivate(id: $id) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                status
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const toggleResponse = await admin.graphql(mutation, {
      variables: { id: existingDiscount.id }
    });

    const data = await toggleResponse.json();
    const result = enable 
      ? data.data?.discountAutomaticActivate 
      : data.data?.discountAutomaticDeactivate;

    if (result?.userErrors?.length > 0) {
      return { success: false, error: result.userErrors[0].message };
    }

    return { success: true, isActive: enable };
  } catch (error) {
    console.error("Error toggling discount:", error);
    return { success: false, error: String(error) };
  }
}

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
      return { 
        success: true, 
        discountId: existingDiscount.id, 
        created: false,
        isActive: existingDiscount.discount?.status === "ACTIVE",
      };
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

    return { success: false, error: "Failed to create discount", isActive: false };
  } catch (error) {
    console.error("Error ensuring Free Gift discount exists:", error);
    return { success: false, error: String(error), isActive: false };
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
