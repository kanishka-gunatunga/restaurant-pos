-- MySQL: backup first. Fails if columns already exist.

ALTER TABLE orders
  ADD COLUMN paymentStatus ENUM('pending', 'paid', 'partial_refund', 'refund') NOT NULL DEFAULT 'pending';

ALTER TABLE payments
  ADD COLUMN payment_role ENUM('sale', 'balance_due') NOT NULL DEFAULT 'sale';
