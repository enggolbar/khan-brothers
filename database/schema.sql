CREATE TABLE IF NOT EXISTS kb_shops (
  id VARCHAR(128) PRIMARY KEY,
  owner_id VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  branch_name VARCHAR(100) NOT NULL DEFAULT '',
  address VARCHAR(240) NOT NULL DEFAULT '',
  phone VARCHAR(25) NOT NULL DEFAULT '',
  bin_number VARCHAR(40) NOT NULL DEFAULT '',
  default_vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  receipt_footer VARCHAR(240) NOT NULL DEFAULT '',
  plan VARCHAR(30) NOT NULL DEFAULT 'growth',
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  invoice_counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX kb_shops_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_documents (
  shop_id VARCHAR(128) NOT NULL,
  collection_path VARCHAR(512) NOT NULL,
  doc_id VARCHAR(128) NOT NULL,
  owner_id VARCHAR(128) NOT NULL,
  data_json JSON NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (shop_id, collection_path, doc_id),
  INDEX kb_documents_owner (owner_id),
  CONSTRAINT kb_documents_shop_fk FOREIGN KEY (shop_id) REFERENCES kb_shops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('super_admin','owner') NOT NULL DEFAULT 'owner',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_signup_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_by CHAR(36) NULL DEFAULT NULL,
  INDEX kb_signup_pending (status, requested_at),
  CONSTRAINT kb_signup_reviewer_fk FOREIGN KEY (reviewed_by) REFERENCES kb_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_signup_details (
  request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  phone VARCHAR(25) NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  business_type VARCHAR(40) NOT NULL,
  address VARCHAR(240) NOT NULL,
  district VARCHAR(80) NOT NULL,
  CONSTRAINT kb_signup_details_request_fk FOREIGN KEY (request_id) REFERENCES kb_signup_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AnZ-Soft Control Center CRM and commercial documents. These names are
-- isolated from the other applications sharing this MySQL database.
CREATE TABLE IF NOT EXISTS kb_admin_customers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(254) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL DEFAULT '',
  district VARCHAR(100) NOT NULL DEFAULT '',
  customer_type VARCHAR(30) NOT NULL DEFAULT 'lead',
  source VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX kb_admin_customers_type (customer_type),
  INDEX kb_admin_customers_phone (phone),
  INDEX kb_admin_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_admin_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  document_no VARCHAR(48) NOT NULL UNIQUE,
  document_type VARCHAR(24) NOT NULL,
  customer_id CHAR(36) NULL,
  customer_snapshot JSON NOT NULL,
  shop_id VARCHAR(128) NULL,
  related_document_id CHAR(36) NULL,
  issue_date DATE NOT NULL,
  due_date DATE NULL,
  status VARCHAR(24) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  lines_json JSON NOT NULL,
  notes TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX kb_admin_docs_type_date (document_type, issue_date),
  INDEX kb_admin_docs_shop (shop_id, document_type, issue_date),
  INDEX kb_admin_docs_customer (customer_id, issue_date),
  INDEX kb_admin_docs_related (related_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
