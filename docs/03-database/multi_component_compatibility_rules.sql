-- =============================================================================
-- 🔧 CNM E-COMMERCE: MULTI-COMPONENT COMBINATORIAL RULES SEED
-- File: docs/03-database/multi_component_compatibility_rules.sql
-- Mô tả: Bộ quy tắc liên kết đa linh kiện chuẩn xác tuyệt đối (A+B, B+C, A+C, A+BC, A+BD)
--        Sẵn sàng import độc lập vào bất kỳ môi trường MySQL nào.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Đảm bảo cấu trúc cột của bảng compatibility_rules
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

-- 2. Nhóm luật Multi-Component Combinatorial:
-- COMP-MULTI-001: CPU High-TDP (125W-250W) ↔ Mainboard Chipset H/A (VRM yếu không heatsink)
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, description, status, is_active, created_at, updated_at
) VALUES (
  'RULE-MULTI-001: CPU High-Power ↔ Mainboard Entry-Level VRM Throttling',
  1, 2, 'tdp_rating', 'vrm_tier', 'NEQ', 0,
  'CẢNH BÁO VRM THROTTLING: CPU công suất cao (TDP > 125W như i7/i9 hoặc Ryzen 9) đi cùng Mainboard phân khúc phổ thông (H610/A620) không tản nhiệt VRM sẽ gây quá nhiệt mạch cấp nguồn, ép CPU tụt xung nghiêm trọng. Bắt buộc dùng Mainboard chipset B/Z series có VRM tối thiểu 10+2 phase.',
  'ACTIVE', 1, NOW(), NOW()
);

-- COMP-MULTI-002: GPU High-Power (>285W) ↔ PSU Non-ATX 3.0 / Thiếu 12V-2x6
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, description, status, is_active, created_at, updated_at
) VALUES (
  'RULE-MULTI-002: GPU High-End ↔ PSU Non-ATX3.0 Transient Spike Risk',
  4, 6, 'gpu_tdp', 'psu_standard', 'NEQ', 0,
  'CẢNH BÁO NGUỒN XUNG KÍCH: Card đồ họa cao cấp (RTX 4070Ti/4080/4090/5070/5080/5090) có dòng xung kích (transient spikes) gấp 2-3 lần công suất danh định. Bắt buộc dùng nguồn chuẩn ATX 3.0/PCIe 5.0 có cổng 12V-2x6 / 12VHPWR nguyên bản để tránh sập nguồn hoặc nóng chảy jack chuyển đổi.',
  'ACTIVE', 1, NOW(), NOW()
);

-- COMP-MULTI-003: CPU Extreme (>200W) ↔ Case Mini/Kín + Tản Khí Nhỏ
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, description, status, is_active, created_at, updated_at
) VALUES (
  'RULE-MULTI-003: CPU High-Heat + Case ITX/Mini ↔ Tản Nhiệt AIO 360mm Bắt Buộc',
  1, 8, 'cpu_thermal_output', 'cooling_type', 'EQ', 0,
  'QUÁ NHIỆT KHÔNG GIAN HẸP: CPU công suất nhiệt lớn trong thùng máy nhỏ kín khí đòi hỏi tản nhiệt nước AIO 240/360mm gắn nóc thổi nhiệt trực tiếp ra ngoài. Không dùng tản khí tháp đơn vì khí nóng tích tụ gây nghẽn nhiệt toàn thùng máy.',
  'ACTIVE', 1, NOW(), NOW()
);

-- COMP-MULTI-004: RAM DDR5 High-Speed (>6000MHz) ↔ 4 Thanh Quad-Stick trên Mainboard 4 khe
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, description, status, is_active, created_at, updated_at
) VALUES (
  'RULE-MULTI-004: RAM DDR5 Quad-Stick Bus Stability Limit',
  3, 2, 'ram_sticks_count', 'ddr5_imc_support', 'LTE', 0,
  'GIỚI HẠN TẦN SỐ DDR5: Chạy 4 thanh RAM DDR5 ở mức bus cao >6000MHz thường vượt quá khả năng ổn định của bộ điều khiển bộ nhớ (IMC) trên CPU/Mainboard phổ thông. Khuyến nghị ưu tiên kit 2 thanh Dual-Channel (2x16GB hoặc 2x32GB) để đạt xung nhịp tối đa ổn định 100%.',
  'ACTIVE', 1, NOW(), NOW()
);

-- COMP-MULTI-005: SSD PCIe Gen 5.0 NVMe ↔ Heatsink Tản Nhiệt Bắt Buộc
INSERT INTO compatibility_rules (
  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,
  operator, is_compatible, description, status, is_active, created_at, updated_at
) VALUES (
  'RULE-MULTI-005: SSD NVMe PCIe 5.0 Thermal Throttling Protection',
  5, 2, 'pcie_gen', 'm2_heatsink_requirement', 'EQ', 1,
  'YÊU CẦU TẢN NHIỆT SSD: SSD chuẩn PCIe 5.0 có tốc độ đọc ghi >10,000 MB/s tỏa lượng nhiệt cực lớn (controller > 80°C). Bắt buộc phải gắn tản nhiệt hợp kim nhôm dày đi kèm bo mạch chủ hoặc heatsink quạt chủ động để tránh tụt băng thông về tốc độ SATA.',
  'ACTIVE', 1, NOW(), NOW()
);

SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================================
-- HOÀN TẤT NẠP QUY TẮC TỔ HỢP ĐA LINH KIỆN
-- =============================================================================
