# BazarGrid POS Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Tenant Isolation (Master Gate)**: Every `product`, `sale`, `customer`, and `branch` document MUST belong to an existing parent `/shops/{shopId}` document whose `ownerId` matches `request.auth.uid`.
2. **Verified Identity**: All create, update, and delete operations require an authenticated, email-verified user (`request.auth.token.email_verified == true`).
3. **Immutable Ownership & Temporal Integrity**: `ownerId`, `shopId`, and `createdAt` can NEVER be altered after creation. `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
4. **Terminal Ledger Lock**: Once a `sale` reaches `'refunded'` or `'voided'`, no non-admin client can modify it again.
5. **Bounded Payloads & Strict Keys**: Every document enforces exact allowed/required keys via `hasAll` / `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, strict `.size()` bounds on every string, and bounded `items` array (1–50 items).
6. **PII Isolation**: Customer phone numbers and addresses in `/shops/{shopId}/customers/{customerId}` are strictly restricted to the shop owner (`resource.data.ownerId == request.auth.uid`). No blanket `isSignedIn()` reads exist.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Shop Create**: `{ "ownerId": "victim_uid", "name": "Fake Shop", ... }` -> `PERMISSION_DENIED`
2. **Shadow Field Injection on Product Create**: `{ ...validProduct, "isVerified": true, "role": "admin" }` -> `PERMISSION_DENIED`
3. **Cross-Tenant Product Write**: User B tries to write to `/shops/shop_of_user_A/products/prod_1` -> `PERMISSION_DENIED`
4. **Orphaned Subcollection Write**: Creating `/shops/nonexistent_shop/products/prod_1` -> `PERMISSION_DENIED`
5. **Client Timestamp Forgery**: Creating a sale with `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()` -> `PERMISSION_DENIED`
6. **Negative Price / Stock Poisoning**: Updating product `sellingPrice: -500` or `stock: -10` -> `PERMISSION_DENIED`
7. **Unverified Email Admin Spoof**: Token with `email: "enggolbar@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`
8. **ID Poisoning**: Creating `/shops/shop_1/products/../../evil%20long%20id` or 200-char ID -> `PERMISSION_DENIED`
9. **Terminal Sale State Mutation**: Attempting to change a `'refunded'` sale back to `'completed'` -> `PERMISSION_DENIED`
10. **Unbounded Array / Type Poisoning on Sale**: Sending `items: []` or `items: ["not_a_map"]` or `items.length > 50` -> `PERMISSION_DENIED`
11. **Customer PII Blanket Read**: User B calling `get` or `list` on `/shops/shop_of_user_A/customers` -> `PERMISSION_DENIED`
12. **Immutable Field Overwrite on Update**: Owner trying to change `ownerId` or `createdAt` on an existing shop or sale -> `PERMISSION_DENIED`
