# Free Gift Discount - Deployment Guide

Deploy the Free Gift Discount function to a live Shopify store.

---

## Prerequisites

- Access to the live store via Shopify Partners
- Node.js installed
- Shopify CLI installed (`npm install -g @shopify/cli`)

---

## Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd eros-functions
npm install
```

---

## Step 2: Connect to the Live Store

```bash
shopify app dev --store your-live-store.myshopify.com
```

- Select the store when prompted
- Wait for the app to start
- The app will be installed on the store automatically

---

## Step 3: Deploy the Function

In a **new terminal** (keep the first one running):

```bash
cd eros-functions
shopify app deploy --force
```

This uploads the discount function to Shopify.

---

## Step 4: Create the Discount

1. Go back to the terminal running `shopify app dev`
2. Press **`g`** to open GraphiQL
3. Run this query to get the function ID:

```graphql
{
  shopifyFunctions(first: 10) {
    nodes {
      id
      title
      apiType
    }
  }
}
```

4. Copy the `id` where `title` is `"free-gift-discount"`

5. Run this mutation (replace `YOUR_FUNCTION_ID`):

```graphql
mutation {
  discountAutomaticAppCreate(
    automaticAppDiscount: {
      title: "Free Gift"
      functionId: "YOUR_FUNCTION_ID"
      startsAt: "2024-01-01T00:00:00Z"
    }
  ) {
    automaticAppDiscount {
      discountId
    }
    userErrors {
      field
      message
    }
  }
}
```

---

## Step 5: Verify

1. Go to **Shopify Admin** → **Discounts**
2. You should see "Free Gift" discount
3. Make sure it's **Active**

---

## Step 6: Done!

Press **Ctrl+C** to stop the local server. The discount will keep working.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `shopify app dev --store STORE.myshopify.com` | Connect to store |
| `shopify app deploy --force` | Deploy function |
| Press `g` in dev terminal | Open GraphiQL |
| `Ctrl+C` | Stop local server |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "DATABASE_URL not found" | Run `cp .env.local .env` |
| "Migration failed" | Run `npx prisma migrate resolve --applied 20240530213853_create_session_table` |
| "Title must be unique" | Discount already exists - check Discounts page |
| Function not found | Run `shopify app deploy --force` first |

---

## Theme Integration

Your theme needs to add free gift items with the `_free_gift` property:

```javascript
fetch('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: variantId,
    quantity: 1,
    properties: {
      "_free_gift": "true"
    }
  })
});
```

---

## How It Works

1. Theme adds a product to cart with `_free_gift: "true"` property
2. The discount function detects items with this property
3. A 100% discount is applied automatically
4. Customer sees "Cadeau gratuit" as the discount message

---

## Managing the Discount

### Turn Off
Shopify Admin → Discounts → Free Gift → Set to **Inactive**

### Turn On
Shopify Admin → Discounts → Free Gift → Set to **Active**

### Delete
Shopify Admin → Discounts → Free Gift → Delete

---

## Support

For issues or questions, contact the development team.
