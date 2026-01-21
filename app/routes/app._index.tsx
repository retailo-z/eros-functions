import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ensureFreeGiftDiscountExists } from "../free-gift-discount.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Automatically create the Free Gift discount if it doesn't exist
  const discountResult = await ensureFreeGiftDiscountExists(admin);
  
  return { discountResult };
};

export default function Index() {
  const { discountResult } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Free Gift Discount">
      <s-section heading="Discount Status">
        {discountResult?.success ? (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="base">
              <s-badge tone="success">Active</s-badge>
              <s-paragraph>
                <s-text fontWeight="bold">Free Gift discount is active!</s-text>
              </s-paragraph>
              <s-paragraph>
                Any cart item with the property <s-text fontWeight="bold">_free_gift: "true"</s-text> will 
                automatically be discounted to $0 with the message "Cadeau gratuit".
              </s-paragraph>
              {discountResult.created && (
                <s-paragraph>
                  <s-text tone="subdued">Discount was just created automatically.</s-text>
                </s-paragraph>
              )}
            </s-stack>
          </s-box>
        ) : (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="base">
              <s-badge tone="critical">Error</s-badge>
              <s-paragraph>
                <s-text>Could not create discount: {discountResult?.error}</s-text>
              </s-paragraph>
              <s-paragraph>
                <s-text tone="subdued">
                  Make sure the app extension is deployed and try refreshing this page.
                </s-text>
              </s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>

      <s-section heading="How it works">
        <s-ordered-list>
          <s-list-item>
            Add a product to the cart with the line item property <s-text fontWeight="bold">_free_gift</s-text> set to <s-text fontWeight="bold">"true"</s-text>
          </s-list-item>
          <s-list-item>
            The discount function automatically detects these items
          </s-list-item>
          <s-list-item>
            A 100% discount is applied with the message "Cadeau gratuit"
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section slot="aside" heading="Integration">
        <s-paragraph>
          To add a free gift to the cart, use the Cart API with the line item property:
        </s-paragraph>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <pre style={{ margin: 0, fontSize: "12px" }}>
{`{
  "properties": {
    "_free_gift": "true"
  }
}`}
          </pre>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
