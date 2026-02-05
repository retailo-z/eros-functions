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

## ✅ Phase 1.5 - Checkout UI Extension - Complete

- [x] Create Checkout UI Extension for gift selection
- [x] Fetch products from configurable collection
- [x] Display scrollable gift selector (max 250px height)
- [x] Add gift to cart with `_free_gift: "true"` attribute
- [x] Remove gift from cart
- [x] Show counter (X/Y selected)
- [x] Threshold check (show message if cart < threshold)
- [x] Max gifts limit (disable buttons when reached)
- [x] Multilanguage support (EN + FR)
- [x] Configurable settings via Checkout Editor:
  - Gift collection handle
  - Cart threshold amount
  - Maximum free gifts

---

## 📋 Phase 2 - Configuration UI & Hosting

See [PHASE2.md](./PHASE2.md) for detailed implementation plan.

- [ ] Host app on Fly.io or Vercel
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

### Two Modes

| Mode | How Gifts Are Added | Use Case |
|------|---------------------|----------|
| **Manual** (default) | Checkout UI / Theme adds `_free_gift` property | Customer chooses gift |
| **Auto** (optional) | Cart Transform adds automatically | Merchant controls gift |

### Technical Requirements
- [ ] Create new extension: `cart-transform-free-gift`
- [ ] Query cart subtotal in function
- [ ] Add specific variant as free gift
- [ ] Prevent duplicate gift additions
- [ ] Handle gift removal if cart drops below threshold
- [ ] **Read enabled/disabled setting from metafield**
- [ ] **Store selected gift product in metafield**

---

## 🎨 Phase 4 - Theme App Extension (Cart Drawer Slider)

### Overview
Add a Theme App Extension that displays a gift collection slider in the cart drawer. This is an alternative to the Checkout UI Extension for stores that prefer gift selection in the cart.

### Features
- [ ] Gift collection slider appears when cart ≥ threshold
- [ ] Merchant selects gift collection from app settings
- [ ] "Add as Gift" button adds item with `_free_gift: "true"`
- [ ] Slider hides when max gifts reached
- [ ] Responsive design (mobile + desktop)
- [ ] Customizable via Theme Editor

### Files to Create
```
extensions/
└── free-gift-slider/
    ├── shopify.extension.toml
    ├── blocks/
    │   └── gift-slider.liquid
    ├── assets/
    │   ├── gift-slider.js
    │   └── gift-slider.css
    └── locales/
        ├── en.default.json
        └── fr.json
```

---

## 💡 Future Ideas (Phase 5+)

### Discount Conflict Handling
- [ ] Check if cart has discount code ≥ 40%
- [ ] Block gift selection if discount conflict
- [ ] Checkout validation to prevent conflicting discounts

### Tiered Thresholds
- [ ] Spend $100 → 1 free gift
- [ ] Spend $200 → 2 free gifts
- [ ] Spend $300 → 3 free gifts

### Product Restrictions
- [ ] Only certain products can be free gifts
- [ ] Tag-based gift eligibility
- [ ] Collection-based gift eligibility

### Analytics
- [ ] Track number of free gifts given
- [ ] Calculate total gift value
- [ ] Conversion impact analysis

---

## 🐛 Known Issues

*None currently*

---

## 📝 Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SHOPIFY STORE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────┐    │
│  │   CHECKOUT PAGE     │    │   PRODUCT DISCOUNT FUNCTION │    │
│  │                     │    │                             │    │
│  │  ┌───────────────┐  │    │  • Detects _free_gift attr  │    │
│  │  │ Gift Selector │  │───▶│  • Applies 100% discount    │    │
│  │  │ UI Extension  │  │    │  • Limits to 3 gifts max    │    │
│  │  │               │  │    │  • Shows "Cadeau gratuit"   │    │
│  │  │ • Collection  │  │    │                             │    │
│  │  │ • Add/Remove  │  │    └─────────────────────────────┘    │
│  │  │ • Counter     │  │                                       │
│  │  │ • i18n        │  │                                       │
│  │  └───────────────┘  │                                       │
│  │                     │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation

| File | Description |
|------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | How to deploy to new stores |
| [PHASE2.md](./PHASE2.md) | Phase 2 detailed plan |
| [TODO.md](./TODO.md) | This file - roadmap & todos |
| [README.md](./README.md) | Project overview |

---

## 🔧 Extension Settings (Checkout Editor)

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| Gift Collection Handle | `gift_collection_handle` | text | `free-gifts` |
| Cart Threshold | `threshold_amount` | number | `0` |
| Maximum Free Gifts | `max_gifts` | integer | `3` |
