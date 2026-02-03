# Free Gift Discount - Todo & Roadmap

## ✅ Phase 1 - Complete

- [x] Create Product Discount Function
- [x] Detect `_free_gift: "true"` property on cart items
- [x] Apply 100% discount to free gift items
- [x] Display "Cadeau gratuit" discount message
- [x] Limit to max 3 free gifts
- [x] Deploy to development store
- [x] Create deployment documentation

---

## 📋 Phase 2 - Configuration UI

See [PHASE2.md](./PHASE2.md) for detailed implementation plan.

- [ ] Host app on Fly.io
- [ ] Add spending threshold setting (min cart subtotal)
- [ ] Add configurable max free gifts
- [ ] Add customizable discount message
- [ ] Create settings UI in app dashboard
- [ ] Store settings in discount metafields
- [ ] Toggle on/off from app UI

---

## 🚀 Phase 3 - Cart Transform (Auto-Add Gifts)

### Overview
Create a Cart Transform Function that automatically adds free gift products to the cart when conditions are met. **This feature is optional and can be enabled/disabled from the app settings.**

### Features
- [ ] Auto-add gift product when cart reaches threshold
- [ ] Merchant selects which product(s) can be free gifts
- [ ] Customer doesn't need to manually add gift
- [ ] Works with existing discount function
- [ ] **Toggle on/off from app settings**

### How It Works
```
[App Settings: Auto-Add Gift = ON]
    ↓
Cart subtotal >= $100
    ↓
Cart Transform adds "Gift Product" with _free_gift: "true"
    ↓
Product Discount Function makes it $0
```

### App Settings UI
```
┌─────────────────────────────────────────────────┐
│  Auto-Add Free Gift                             │
├─────────────────────────────────────────────────┤
│  ☑️  Enable automatic gift adding               │
│                                                 │
│  Gift Product: [Select product ▼]              │
│                                                 │
│  Minimum Cart Total: [$___100.00___]           │
│                                                 │
│  ℹ️  When enabled, the selected product will   │
│     be automatically added to carts that meet  │
│     the minimum total. Customers won't need    │
│     to manually add the gift.                  │
│                                                 │
│  ⚠️  When disabled, use your theme to add      │
│     items with _free_gift: "true" property.    │
└─────────────────────────────────────────────────┘
```

### Two Modes

| Mode | How Gifts Are Added | Use Case |
|------|---------------------|----------|
| **Manual** (default) | Theme adds `_free_gift` property | Customer chooses gift |
| **Auto** (optional) | Cart Transform adds automatically | Merchant controls gift |

### Technical Requirements
- [ ] Create new extension: `cart-transform-free-gift`
- [ ] Query cart subtotal in function
- [ ] Add specific variant as free gift
- [ ] Prevent duplicate gift additions
- [ ] Handle gift removal if cart drops below threshold
- [ ] **Read enabled/disabled setting from metafield**
- [ ] **Store selected gift product in metafield**

### Files to Create
```
extensions/
└── cart-transform-free-gift/
    ├── shopify.extension.toml
    └── src/
        ├── run.graphql
        └── run.ts
```

### Database Schema Addition
```prisma
model FreeGiftSettings {
  // ... existing fields ...
  
  // Cart Transform settings
  autoAddEnabled    Boolean  @default(false)
  autoAddProductId  String?  // Gift product GID
  autoAddVariantId  String?  // Gift variant GID
}
```

### Considerations
- **Default is OFF** - theme-based approach works out of the box
- Customer cannot choose gift when auto-add is ON
- Need to store gift variant ID in metafields
- Handle edge cases (gift out of stock, etc.)
- Clear messaging about which mode is active

---

## 🎨 Phase 4 - Theme App Extension (Gift Slider UI)

### Overview
Add a Theme App Extension that displays a gift collection slider in the cart drawer when the cart meets the spending threshold. Customers can browse and select their free gift directly from the cart.

### Features
- [ ] Gift collection slider appears when cart ≥ threshold
- [ ] Merchant selects gift collection from app settings
- [ ] "Add as Gift" button adds item with `_free_gift: "true"`
- [ ] Slider hides when max gifts reached
- [ ] Responsive design (mobile + desktop)
- [ ] Customizable via Theme Editor

### How It Works
```
Cart subtotal >= $100
    ↓
Theme App Extension shows gift slider in cart drawer
    ↓
Customer clicks "Add as Gift" on product
    ↓
JS adds product with _free_gift: "true" property
    ↓
Product Discount Function makes it $0
```

### Files to Create
```
extensions/
└── free-gift-slider/
    ├── shopify.extension.toml
    ├── blocks/
    │   └── gift-slider.liquid      # App Block for cart
    ├── assets/
    │   ├── gift-slider.js          # Slider logic
    │   └── gift-slider.css         # Styling
    └── locales/
        ├── en.default.json
        └── fr.json
```

### App Block Code Preview (gift-slider.liquid)
```liquid
{% if cart.total_price >= block.settings.threshold %}
  <div class="free-gift-slider" data-max-gifts="{{ block.settings.max_gifts }}">
    <h3>{{ block.settings.heading }}</h3>
    <div class="gift-slider__products">
      {% for product in collections[block.settings.collection].products limit: 10 %}
        <div class="gift-slider__product">
          <img src="{{ product.featured_image | img_url: '200x200' }}" alt="{{ product.title }}">
          <p>{{ product.title }}</p>
          <button 
            class="gift-slider__add-btn"
            data-variant-id="{{ product.selected_or_first_available_variant.id }}"
          >
            {{ block.settings.button_text }}
          </button>
        </div>
      {% endfor %}
    </div>
  </div>
{% endif %}

{% schema %}
{
  "name": "Free Gift Slider",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Choose your free gift!"
    },
    {
      "type": "collection",
      "id": "collection",
      "label": "Gift Collection"
    },
    {
      "type": "range",
      "id": "threshold",
      "label": "Minimum Cart Total (cents)",
      "min": 0,
      "max": 50000,
      "step": 100,
      "default": 10000
    },
    {
      "type": "range",
      "id": "max_gifts",
      "label": "Maximum Free Gifts",
      "min": 1,
      "max": 5,
      "default": 3
    },
    {
      "type": "text",
      "id": "button_text",
      "label": "Button Text",
      "default": "Add as Gift"
    }
  ]
}
{% endschema %}
```

### JavaScript (gift-slider.js)
```javascript
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.gift-slider__add-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const variantId = e.target.dataset.variantId;
      
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: variantId,
          quantity: 1,
          properties: {
            '_free_gift': 'true'
          }
        })
      });
      
      // Refresh cart drawer
      window.location.reload();
    });
  });
});
```

### App Settings Integration
- [ ] Store selected collection in app metafields
- [ ] Sync threshold with discount function settings
- [ ] Sync max gifts with discount function settings

### Theme Editor Settings
Merchants can customize via Shopify Theme Editor:
- Heading text
- Gift collection
- Minimum cart threshold
- Max gifts allowed
- Button text
- Colors/styling

### Considerations
- Must work with various themes (Dawn, custom, etc.)
- Need fallback if cart drawer doesn't support App Blocks
- Consider lazy loading for performance
- Handle out-of-stock products gracefully

---

## 💡 Future Ideas (Phase 5+)

### Tiered Thresholds
- [ ] Spend $100 → 1 free gift
- [ ] Spend $200 → 2 free gifts
- [ ] Spend $300 → 3 free gifts

### Product Restrictions
- [ ] Only certain products can be free gifts
- [ ] Tag-based gift eligibility
- [ ] Collection-based gift eligibility

### Time-Based Promotions
- [ ] Free gifts only during sale periods
- [ ] Holiday-specific gifts
- [ ] Flash sale gifts

### Analytics
- [ ] Track number of free gifts given
- [ ] Calculate total gift value
- [ ] Conversion impact analysis

### Multi-Language
- [ ] Translatable discount message
- [ ] Locale-based message selection

---

## 🐛 Known Issues

*None currently*

---

## 📝 Notes

### Current Limitations
1. Theme must add `_free_gift: "true"` property (Phase 3 will automate this)
2. App UI requires local server or hosting (Phase 2 will add hosting)
3. Settings are hardcoded (Phase 2 will make configurable)

### Testing Checklist
- [ ] Test with 1 free gift
- [ ] Test with 3 free gifts (max)
- [ ] Test with 4+ free gifts (should only discount 3)
- [ ] Test without free gifts
- [ ] Test discount toggle on/off

---

## 📚 Documentation

| File | Description |
|------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | How to deploy to new stores |
| [PHASE2.md](./PHASE2.md) | Phase 2 detailed plan |
| [TODO.md](./TODO.md) | This file - roadmap & todos |
| [README.md](./README.md) | Project overview |
