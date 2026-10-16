-- =============================================================================
-- 🔧 CNM E-COMMERCE: COMPREHENSIVE COMPATIBILITY RULES SEED (436 RULES)
-- File: docs/03-database/phase11_compatibility_rules_seed.sql
-- Tính chất: Độc lập hoàn toàn, tự resolve ID linh hoạt qua subquery.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Đảm bảo cấu trúc cột của bảng compatibility_rules đã có đầy đủ
CREATE TABLE IF NOT EXISTS compatibility_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NULL,
  attribute_value_1 INT NULL,
  attribute_value_2 INT NULL,
  is_compatible TINYINT(1) NOT NULL DEFAULT 1,
  source_category_id INT NULL,
  target_category_id INT NULL,
  source_attribute_key VARCHAR(255) NULL,
  target_attribute_key VARCHAR(255) NULL,
  operator VARCHAR(20) NULL DEFAULT 'EQ',
  description TEXT NULL,
  status VARCHAR(50) NULL DEFAULT 'ACTIVE',
  is_active TINYINT(1) NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Thêm cột name nếu bảng đã tồn tại từ trước mà chưa có cột name (dùng Stored Procedure an toàn tương thích mọi MySQL)
DROP PROCEDURE IF EXISTS AddNameColumnIfMissing;
DELIMITER $$
CREATE PROCEDURE AddNameColumnIfMissing()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compatibility_rules' AND COLUMN_NAME = 'name'
  ) THEN
    ALTER TABLE compatibility_rules ADD COLUMN name VARCHAR(255) NULL AFTER id;
  END IF;
END $$
DELIMITER ;
CALL AddNameColumnIfMissing();
DROP PROCEDURE IF EXISTS AddNameColumnIfMissing;

-- Xóa rules cũ trước khi nạp bộ quy tắc mới
DELETE FROM compatibility_rules;

-- 2. Nạp toàn bộ quy tắc tương thích chuẩn xác kỹ thuật 100%

INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1851 ↔ Mainboard LGA1851', 1, 2, 'socket', 'socket',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'TƯƠNG THÍCH: CPU LGA1851 (Intel Arrow Lake Core Ultra Series 2) tương thích hoàn hảo với Mainboard chuẩn socket LGA1851.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1851 ↔ Mainboard LGA1700', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1851 ↔ Mainboard LGA1200', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1851 ↔ Mainboard AM5', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1851 ↔ Mainboard AM4', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1700 ↔ Mainboard LGA1851', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1700 ↔ Mainboard LGA1700', 1, 2, 'socket', 'socket',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'TƯƠNG THÍCH: CPU LGA1700 (Intel Gen 12/13/14 Raptor Lake / Alder Lake) tương thích hoàn hảo với Mainboard chuẩn socket LGA1700.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1700 ↔ Mainboard LGA1200', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1700 ↔ Mainboard AM5', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1700 ↔ Mainboard AM4', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1200 ↔ Mainboard LGA1851', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1200 ↔ Mainboard LGA1700', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1200 ↔ Mainboard LGA1200', 1, 2, 'socket', 'socket',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'TƯƠNG THÍCH: CPU LGA1200 (Intel Gen 10/11 Comet Lake / Rocket Lake) tương thích hoàn hảo với Mainboard chuẩn socket LGA1200.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1200 ↔ Mainboard AM5', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU LGA1200 ↔ Mainboard AM4', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM5 ↔ Mainboard LGA1851', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM5 ↔ Mainboard LGA1700', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM5 ↔ Mainboard LGA1200', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM5 ↔ Mainboard AM5', 1, 2, 'socket', 'socket',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'TƯƠNG THÍCH: CPU AM5 (AMD Ryzen 7000/8000/9000 Series) tương thích hoàn hảo với Mainboard chuẩn socket AM5.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM5 ↔ Mainboard AM4', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM4 ↔ Mainboard LGA1851', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM4 ↔ Mainboard LGA1700', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM4 ↔ Mainboard LGA1200', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM4 ↔ Mainboard AM5', 1, 2, 'socket', 'socket',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'CPU AM4 ↔ Mainboard AM4', 1, 2, 'socket', 'socket',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'TƯƠNG THÍCH: CPU AM4 (AMD Ryzen 1000/2000/3000/4000/5000 Series) tương thích hoàn hảo với Mainboard chuẩn socket AM4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR5 ↔ Mainboard DDR5', 3, 2, 'ram_type', 'ram_type',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), 'TƯƠNG THÍCH: Bộ nhớ RAM DDR5 tương thích chuẩn với khe cắm DDR5 trên bo mạch chủ.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR5 ↔ Mainboard DDR4', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR5 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR5 ↔ Mainboard DDR3', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR5 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR3.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR4 ↔ Mainboard DDR5', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR4 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR5.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR4 ↔ Mainboard DDR4', 3, 2, 'ram_type', 'ram_type',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), 'TƯƠNG THÍCH: Bộ nhớ RAM DDR4 tương thích chuẩn với khe cắm DDR4 trên bo mạch chủ.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR4 ↔ Mainboard DDR3', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR4 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR3.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR3 ↔ Mainboard DDR5', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR3 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR5.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR3 ↔ Mainboard DDR4', 3, 2, 'ram_type', 'ram_type',
  'NEQ', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: RAM DDR3 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'RAM DDR3 ↔ Mainboard DDR3', 3, 2, 'ram_type', 'ram_type',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'ram_type' AND av.value = 'DDR3' LIMIT 1), 'TƯƠNG THÍCH: Bộ nhớ RAM DDR3 tương thích chuẩn với khe cắm DDR3 trên bo mạch chủ.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard E-ATX ↔ Case E-ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ E-ATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard E-ATX ↔ Case ATX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard E-ATX ↔ Case mATX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn mATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard E-ATX ↔ Case ITX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ATX ↔ Case E-ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ATX ↔ Case ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ATX ↔ Case mATX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn mATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ATX ↔ Case ITX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard mATX ↔ Case E-ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard mATX ↔ Case ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard mATX ↔ Case mATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy mATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard mATX ↔ Case ITX', 2, 7, 'form_factor', 'form_factor',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Bo mạch chủ mATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ITX ↔ Case E-ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ITX ↔ Case ATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ITX ↔ Case mATX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy mATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Mainboard ITX ↔ Case ITX', 2, 7, 'form_factor', 'form_factor',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'TƯƠNG THÍCH: Thùng máy ITX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 120mm ↔ Case hỗ trợ 120mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '120mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '120mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 120mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 120mm ↔ Case hỗ trợ 240mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '120mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '240mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 240mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 120mm ↔ Case hỗ trợ 280mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '120mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '280mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 120mm ↔ Case hỗ trợ 360mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '120mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '360mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 120mm ↔ Case hỗ trợ 420mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '120mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '420mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 240mm ↔ Case hỗ trợ 120mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '240mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '120mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 240mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 240mm ↔ Case hỗ trợ 240mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '240mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '240mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 240mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 240mm ↔ Case hỗ trợ 280mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '240mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '280mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 240mm ↔ Case hỗ trợ 360mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '240mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '360mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 240mm ↔ Case hỗ trợ 420mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '240mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '420mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 280mm ↔ Case hỗ trợ 120mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '280mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '120mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 280mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 280mm ↔ Case hỗ trợ 240mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '280mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '240mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 280mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 280mm ↔ Case hỗ trợ 280mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '280mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '280mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 280mm ↔ Case hỗ trợ 360mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '280mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '360mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 280mm ↔ Case hỗ trợ 420mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '280mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '420mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 360mm ↔ Case hỗ trợ 120mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '360mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '120mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 360mm ↔ Case hỗ trợ 240mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '360mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '240mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 360mm ↔ Case hỗ trợ 280mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '360mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '280mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 280mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 360mm ↔ Case hỗ trợ 360mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '360mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '360mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 360mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 360mm ↔ Case hỗ trợ 420mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '360mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '420mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 360mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 420mm ↔ Case hỗ trợ 120mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '420mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '120mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 420mm ↔ Case hỗ trợ 240mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '420mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '240mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 420mm ↔ Case hỗ trợ 280mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '420mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '280mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 280mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 420mm ↔ Case hỗ trợ 360mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '420mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '360mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 360mm.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Radiator AIO 420mm ↔ Case hỗ trợ 420mm', 8, 7, 'radiator_size', 'case_radiator_support',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'radiator_size' AND av.value = '420mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_radiator_support' AND av.value = '420mm' LIMIT 1), 'TƯƠNG THÍCH: Két nước tản AIO 420mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 148mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 154mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 155mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 157mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 160mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 165mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 148mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '148mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 154mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 154mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 155mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 157mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 160mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 165mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 154mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '154mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 157mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 160mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 165mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 157mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '157mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 160mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 165mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 160mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '160mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 160mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 165mm nằm trong giới hạn cho phép 165mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 165mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '165mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 165mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 148mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '148mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 154mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '154mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 155mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '155mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 157mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '157mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 160mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '160mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 160mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 165mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '165mm' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 165mm).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản khí 170mm ↔ Case giới hạn 170mm', 8, 7, 'cooler_height', 'case_cooler_clearance',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooler_height' AND av.value = '170mm' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'case_cooler_clearance' AND av.value = '170mm' LIMIT 1), 'TƯƠNG THÍCH: Chiều cao tản nhiệt khí 170mm nằm trong giới hạn cho phép 170mm của nắp hông case.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 35W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '35W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 65W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 95W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 105W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 120W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 125W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 150W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 160W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 170W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 180W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '180W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 200W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 200W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 220W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 220W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 250W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 250W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 260W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 260W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 300W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 320W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 350W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 180W ↔ CPU TDP 450W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '180W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 35W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '35W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 65W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 95W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 105W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 120W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 125W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 150W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 160W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 170W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 180W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '180W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 200W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 220W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 250W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 250W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 260W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 260W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 300W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 320W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 350W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 220W ↔ CPU TDP 450W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '220W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 35W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '35W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 65W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 95W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 105W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 120W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 125W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 150W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 160W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 170W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 180W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '180W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 200W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 220W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 250W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 260W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 300W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 320W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 350W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 260W ↔ CPU TDP 450W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '260W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 35W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '35W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 65W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 95W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 105W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 120W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 125W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 150W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 160W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 170W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 180W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '180W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 200W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 220W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 250W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 260W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 300W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 300W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 320W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 350W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 300W ↔ CPU TDP 450W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '300W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 35W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '35W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 65W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 95W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 105W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 120W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 125W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 150W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 160W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 170W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 180W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '180W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 200W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 220W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 250W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 260W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 300W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 300W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 320W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 320W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 350W', 8, 1, 'cooling_capacity', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 350W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản nhiệt 350W ↔ CPU TDP 450W', 8, 1, 'cooling_capacity', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'cooling_capacity' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 350W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 350W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3050 / GTX 1660S (TDP 120W, yêu cầu tối thiểu 450W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4060 / RX 6600 (TDP 150W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4060 Ti / RX 7600 (TDP 160W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 450W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 450W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4060 / RX 6600 (TDP 150W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4060 Ti / RX 7600 (TDP 160W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 750W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'CẢNH BÁO THIẾU NGUỒN: Nguồn 750W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 95W (GTX 1650 / RX 6400)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '95W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '120W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 150W (RTX 4060 / RX 6600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '150W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '160W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '220W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '260W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 300W (RTX 4070 Ti Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '300W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 320W (RTX 4080 Super)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '320W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '350W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX)', 6, 4, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '450W' LIMIT 1), 'TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1851', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1851, LGA1700, AM5, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1851 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1700', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1851, LGA1700, AM5, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1200', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1851, LGA1700, AM5, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU AM5', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1851, LGA1700, AM5, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU AM4', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1851, LGA1700, AM5, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM4 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1200, AM4) ↔ CPU LGA1851', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1200, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1200, AM4) ↔ CPU LGA1700', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1200, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1700.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1200, AM4) ↔ CPU LGA1200', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1200, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1200 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1200, AM4) ↔ CPU AM5', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1200, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM5.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1200, AM4) ↔ CPU AM4', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1200, AM4' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM4 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700) ↔ CPU LGA1851', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700) ↔ CPU LGA1700', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700) ↔ CPU LGA1200', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700) ↔ CPU AM5', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM5.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700) ↔ CPU AM4', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (AM5) ↔ CPU LGA1851', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (AM5) ↔ CPU LGA1700', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1700.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (AM5) ↔ CPU LGA1200', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (AM5) ↔ CPU AM5', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (AM5) ↔ CPU AM4', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700, AM5) ↔ CPU LGA1851', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700, AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1851' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700, AM5) ↔ CPU LGA1700', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700, AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1700' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700, AM5) ↔ CPU LGA1200', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700, AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'LGA1200' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700, AM5) ↔ CPU AM5', 8, 1, 'socket_support', 'socket',
  'IN', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700, AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM5' LIMIT 1), 'TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ngàm tản (LGA1700, AM5) ↔ CPU AM4', 8, 1, 'socket_support', 'socket',
  'NOT_IN', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket_support' AND av.value = 'LGA1700, AM5' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'socket' AND av.value = 'AM4' LIMIT 1), 'KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 350W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Ryzen 7 / Core i7 Non-K (TDP 105W, yêu cầu tối thiểu 450W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Intel K-series / Ryzen 9 (TDP 125W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 350W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '350W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 450W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 450W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Intel K-series / Ryzen 9 (TDP 125W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 450W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '450W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 500W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '500W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 550W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '550W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 650W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'LT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '650W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO CÔNG SUẤT: Nguồn 650W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 750W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '750W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 850W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '850W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1000W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1000W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1200W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1200W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 125W (Intel K-series / Ryzen 9)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 200W (Core i7-14700K Boost PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Nguồn 1600W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2)', 6, 1, 'psu_wattage', 'tdp',
  'GTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'psu_wattage' AND av.value = '1600W' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W).', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng NVMe ↔ Mainboard E-ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'NVMe' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng NVMe ↔ Mainboard ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'NVMe' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng NVMe ↔ Mainboard mATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'NVMe' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng NVMe ↔ Mainboard ITX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'NVMe' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng SATA SSD ↔ Mainboard E-ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'SATA SSD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng SATA SSD ↔ Mainboard ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'SATA SSD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng SATA SSD ↔ Mainboard mATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'SATA SSD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng SATA SSD ↔ Mainboard ITX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'SATA SSD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng HDD ↔ Mainboard E-ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'HDD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'E-ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng HDD ↔ Mainboard ATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'HDD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng HDD ↔ Mainboard mATX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'HDD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'mATX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Ổ cứng HDD ↔ Mainboard ITX', 5, 2, 'storage_type', 'form_factor',
  'EQ', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'storage_type' AND av.value = 'HDD' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'form_factor' AND av.value = 'ITX' LIMIT 1), 'TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 65W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'TƯƠNG THÍCH: Tản nhiệt kèm hộp đáp ứng vừa vặn cho CPU tiết kiệm điện TDP 65W.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 105W', 1, 1, 'stock_cooler', 'tdp',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 105W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 125W', 1, 1, 'stock_cooler', 'tdp',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 125W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 170W', 1, 1, 'stock_cooler', 'tdp',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 170W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 200W', 1, 1, 'stock_cooler', 'tdp',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 200W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [Yes] ↔ CPU TDP 250W', 1, 1, 'stock_cooler', 'tdp',
  'GT', 0, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'Yes' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 250W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 65W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '65W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 105W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '105W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 125W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '125W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 170W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '170W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 200W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '200W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at
) VALUES (
  'Tản hộp [No] ↔ CPU TDP 250W', 1, 1, 'stock_cooler', 'tdp',
  'LTE', 1, (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'stock_cooler' AND av.value = 'No' LIMIT 1), (SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = 'tdp' AND av.value = '250W' LIMIT 1), 'KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.', 'ACTIVE', 1, NOW(), NOW()
);

SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================================
-- HOÀN TẤT NẠP QUY TẮC TƯƠNG THÍCH
-- =============================================================================