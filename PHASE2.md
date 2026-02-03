# Phase 2 - Free Gift Discount Enhancements

## Overview

Phase 2 adds configurable settings for the Free Gift Discount, including spending thresholds and maximum gift limits.

---

## Features

### 1. Spending Threshold
Allow merchants to set a minimum cart subtotal required to qualify for free gifts.

**Example:**
- Threshold: $100
- Cart subtotal $80 → No free gifts
- Cart subtotal $120 → Free gifts apply

### 2. Configurable Max Free Gifts
Allow merchants to set the maximum number of free gifts per order (currently hardcoded to 3).

**Options:**
- 1, 2, 3, 5, or unlimited

### 3. App UI Dashboard
A hosted app interface where merchants can:
- Toggle discount on/off
- Set spending threshold
- Set max free gifts
- View discount status

---

## Technical Implementation

### Database Schema

Add a settings table to store merchant configurations:

```prisma
model FreeGiftSettings {
  id                String   @id @default(uuid())
  shop              String   @unique
  isEnabled         Boolean  @default(true)
  minCartSubtotal   Decimal  @default(0)
  maxFreeGifts      Int      @default(3)
  discountMessage   String   @default("Cadeau gratuit")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Function Updates

Update `run.graphql` to fetch cart subtotal:

```graphql
query RunInput {
  cart {
    cost {
      subtotalAmount {
        amount
      }
    }
    lines {
      id
      quantity
      freeGiftAttribute: attribute(key: "_free_gift") {
        value
      }
    }
  }
  discountNode {
    metafield(namespace: "free-gift", key: "settings") {
      value
    }
  }
}
```

Update `run.ts` to check threshold:

```typescript
const FREE_GIFT_MESSAGE = "Cadeau gratuit";

export function run(input: RunInput): FunctionRunResult {
  // Get settings from metafield
  const settings = JSON.parse(
    input.discountNode?.metafield?.value || '{}'
  );
  
  const minSubtotal = settings.minCartSubtotal || 0;
  const maxFreeGifts = settings.maxFreeGifts || 3;
  const message = settings.discountMessage || FREE_GIFT_MESSAGE;

  // Check if cart meets threshold
  const cartSubtotal = parseFloat(input.cart.cost.subtotalAmount.amount);
  
  if (cartSubtotal < minSubtotal) {
    return EMPTY_DISCOUNT;
  }

  // Find free gift lines (limited to max)
  const freeGiftLines = input.cart.lines
    .filter((line) => line.freeGiftAttribute?.value === "true")
    .slice(0, maxFreeGifts);

  // ... rest of discount logic
}
```

### App UI Updates

Add settings form to `app._index.tsx`:

```tsx
<s-section heading="Settings">
  <s-form-layout>
    <s-text-field
      label="Minimum Cart Subtotal"
      type="number"
      prefix="$"
      value={settings.minCartSubtotal}
      onChange={handleSubtotalChange}
    />
    
    <s-select
      label="Maximum Free Gifts"
      options={[
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "5", value: "5" },
        { label: "Unlimited", value: "0" },
      ]}
      value={settings.maxFreeGifts}
      onChange={handleMaxGiftsChange}
    />
    
    <s-text-field
      label="Discount Message"
      value={settings.discountMessage}
      onChange={handleMessageChange}
    />
    
    <s-button variant="primary" onClick={saveSettings}>
      Save Settings
    </s-button>
  </s-form-layout>
</s-section>
```

### Metafield Storage

Store settings in discount metafields:

```typescript
async function saveSettings(admin, discountId, settings) {
  await admin.graphql(`
    mutation UpdateDiscountMetafield($id: ID!, $metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      metafields: [{
        ownerId: discountId,
        namespace: "free-gift",
        key: "settings",
        type: "json",
        value: JSON.stringify(settings)
      }]
    }
  });
}
```

---

## Hosting Requirements

Phase 2 requires the app to be hosted for:
- Persistent settings storage
- Merchant-accessible UI
- OAuth authentication

**Recommended:** Fly.io (free tier)

### Deployment Steps

1. Set up Fly.io account
2. Configure environment variables
3. Deploy app
4. Update Shopify app URLs
5. Test OAuth flow

---

## Tasks Checklist

### Infrastructure
- [ ] Set up Fly.io hosting
- [ ] Configure PostgreSQL database
- [ ] Set up environment variables
- [ ] Update Shopify app URLs

### Database
- [ ] Add FreeGiftSettings model to Prisma schema
- [ ] Create migration
- [ ] Deploy migration to production

### Function Updates
- [ ] Update run.graphql to fetch cart subtotal
- [ ] Update run.graphql to fetch metafield settings
- [ ] Update run.ts to check threshold
- [ ] Update run.ts to use configurable max gifts
- [ ] Update run.ts to use configurable message
- [ ] Add tests for threshold logic
- [ ] Deploy updated function

### App UI
- [ ] Add settings form components
- [ ] Add save settings action
- [ ] Add load settings in loader
- [ ] Add validation for inputs
- [ ] Add success/error toasts
- [ ] Test settings persistence

### Testing
- [ ] Test threshold enforcement
- [ ] Test max gifts limit
- [ ] Test settings persistence
- [ ] Test discount toggle
- [ ] End-to-end testing

---

## Timeline Estimate

| Task | Estimate |
|------|----------|
| Hosting setup | 1-2 hours |
| Database updates | 1 hour |
| Function updates | 2-3 hours |
| App UI updates | 3-4 hours |
| Testing | 2-3 hours |
| **Total** | **9-13 hours** |

---

## Future Considerations (Phase 3+)

- Tiered thresholds (spend $100 = 1 gift, $200 = 2 gifts)
- Specific product restrictions (only certain products can be gifts)
- Time-based promotions (free gifts only during sale periods)
- Analytics dashboard (how many free gifts given, value saved)
- Multi-language support for discount message
