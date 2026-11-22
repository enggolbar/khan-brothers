/**
 * Security Rules Test Specification for BazarGrid Smart Super Shop POS
 * Covers the "Dirty Dozen" adversarial payloads defined in security_spec.md.
 * Run with Firebase Emulator Suite (@firebase/rules-unit-testing).
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  actor: { uid: string; email: string; email_verified: boolean };
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Shop Create',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/shop_spoof',
    payload: { ownerId: 'victim_uid', name: 'Hijacked Shop', currency: 'BDT' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Product Create',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/shop_a/products/prod_1',
    payload: { shopId: 'shop_a', ownerId: 'owner_a', name: 'Rice', isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Tenant Product Write',
    actor: { uid: 'owner_b', email: 'b@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/shop_a/products/prod_x',
    payload: { shopId: 'shop_a', ownerId: 'owner_b', name: 'Injected SKU' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Subcollection Write',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/nonexistent_shop/products/prod_1',
    payload: { shopId: 'nonexistent_shop', ownerId: 'owner_a', name: 'Orphan' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Client Timestamp Forgery on Sale',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/shop_a/sales/sale_forged',
    payload: { shopId: 'shop_a', ownerId: 'owner_a', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Negative Selling Price Poisoning',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'update',
    path: '/shops/shop_a/products/prod_1',
    payload: { sellingPrice: -500 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unverified Email Admin Spoof',
    actor: { uid: 'spoof_admin', email: 'enggolbar@gmail.com', email_verified: false },
    operation: 'get',
    path: '/shops/shop_a',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Oversized Document ID Poisoning',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'create',
    path: `/shops/shop_a/products/${'a'.repeat(200)}`,
    payload: { shopId: 'shop_a', ownerId: 'owner_a', name: 'Long ID' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal Sale State Mutation (Refunded -> Completed)',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'update',
    path: '/shops/shop_a/sales/sale_refunded',
    payload: { status: 'completed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Empty or Malformed Sale Items Array',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'create',
    path: '/shops/shop_a/sales/sale_bad_items',
    payload: { shopId: 'shop_a', ownerId: 'owner_a', items: [] },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Customer PII Blanket Read by Non-Owner',
    actor: { uid: 'owner_b', email: 'b@example.com', email_verified: true },
    operation: 'get',
    path: '/shops/shop_a/customers/cust_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immutable Owner Overwrite on Shop Update',
    actor: { uid: 'owner_a', email: 'owner@example.com', email_verified: true },
    operation: 'update',
    path: '/shops/shop_a',
    payload: { ownerId: 'owner_b' },
    expected: 'PERMISSION_DENIED',
  },
];
