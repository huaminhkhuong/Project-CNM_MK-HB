/**
 * Script xuất toàn bộ cơ sở dữ liệu MySQL ra file SQL dump
 * Xuất vào thư mục /data theo yêu cầu của người dùng:
 * 1. T:\Khoa_luan\data\cnm_mk_hb_dump.sql
 * 2. T:\Khoa_luan\database\cnm_mk_hb_dump.sql (đồng bộ bản backup)
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (isNaN(val)) return 'NULL';
    return String(val);
  }
  if (typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = val.getFullYear();
    const m = pad(val.getMonth() + 1);
    const d = pad(val.getDate());
    const h = pad(val.getHours());
    const mi = pad(val.getMinutes());
    const s = pad(val.getSeconds());
    return `'${y}-${m}-${d} ${h}:${mi}:${s}'`;
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x1a/g, '\\Z');

  return `'${str}'`;
}

async function exportDatabase() {
  console.log('================================================================');
  console.log('       TIẾN HÀNH XUẤT FILE DATABASE DUMP MỚI VÀO THƯ MỤC /DATA   ');
  console.log('================================================================\n');

  const ROOT_DIR = path.resolve(__dirname, '../../..');
  const DATA_DIR = path.join(ROOT_DIR, 'data');
  const DATABASE_DIR = path.join(ROOT_DIR, 'database');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const targetDataFile = path.join(DATA_DIR, 'cnm_mk_hb_dump.sql');
  const targetDbFile = path.join(DATABASE_DIR, 'cnm_mk_hb_dump.sql');

  const stream = fs.createWriteStream(targetDataFile, { encoding: 'utf8' });

  // Header
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  stream.write(`-- PC Mall MySQL Database Dump\n`);
  stream.write(`-- Dump Time: ${now}\n`);
  stream.write(`-- Database: cnm_mk_hb\n`);
  stream.write(`-- ------------------------------------------------------\n\n`);
  stream.write(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`);
  stream.write(`/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n`);
  stream.write(`/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n`);
  stream.write(`/*!50503 SET NAMES utf8mb4 */;\n`);
  stream.write(`/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n`);
  stream.write(`/*!40103 SET TIME_ZONE='+00:00' */;\n`);
  stream.write(`/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n`);
  stream.write(`/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`);
  stream.write(`/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n`);
  stream.write(`/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n`);

  stream.write(`CREATE DATABASE /*!32312 IF NOT EXISTS*/ \`cnm_mk_hb\` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;\n`);
  stream.write(`USE \`cnm_mk_hb\`;\n\n`);

  const tablesResult = await query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tablesResult.map(t => Object.values(t)[0]);
  console.log(`📦 Tìm thấy ${tables.length} bảng trong cơ sở dữ liệu cnm_mk_hb.\n`);

  let totalRows = 0;

  for (const tableName of tables) {
    console.log(`⚡ Đang xuất bảng: ${tableName}...`);

    stream.write(`--\n-- Table structure for table \`${tableName}\`\n--\n\n`);
    stream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
    stream.write(`/*!40101 SET @saved_cs_client     = @@character_set_client */;\n`);
    stream.write(`/*!50503 SET character_set_client = utf8mb4 */;\n`);

    const createTableResult = await query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = createTableResult[0]['Create Table'];
    stream.write(`${createSql};\n`);
    stream.write(`/*!40101 SET character_set_client = @saved_cs_client */;\n\n`);

    // Data
    stream.write(`--\n-- Dumping data for table \`${tableName}\`\n--\n\n`);
    stream.write(`LOCK TABLES \`${tableName}\` WRITE;\n`);
    stream.write(`/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`);

    const rows = await query(`SELECT * FROM \`${tableName}\``);
    totalRows += rows.length;

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]).map(col => `\`${col}\``).join(', ');
      
      const BATCH_SIZE = 200;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesList = batch.map(row => {
          const values = Object.values(row).map(escapeSqlValue).join(', ');
          return `(${values})`;
        }).join(',\n');

        stream.write(`INSERT INTO \`${tableName}\` (${columns}) VALUES\n${valuesList};\n`);
      }
      console.log(`   ✓ Đã xuất ${rows.length} dòng.`);
    } else {
      console.log(`   (Bảng trống - 0 dòng)`);
    }

    stream.write(`/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`);
    stream.write(`UNLOCK TABLES;\n\n`);
  }

  // Footer
  stream.write(`/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n`);
  stream.write(`/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`);
  stream.write(`/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`);
  stream.write(`/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n`);
  stream.write(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`);
  stream.write(`/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n`);
  stream.write(`/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n`);
  stream.write(`/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n`);
  stream.write(`-- Dump completed on ${new Date().toISOString().replace('T', ' ').slice(0, 19)}\n`);

  await new Promise(resolve => stream.end(resolve));

  const stats = fs.statSync(targetDataFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Đã xuất thành công: ${targetDataFile} (${sizeMB} MB, ${totalRows} dòng dữ liệu)`);

  // Đồng bộ sang thư mục database/ nếu tồn tại
  if (fs.existsSync(DATABASE_DIR)) {
    fs.copyFileSync(targetDataFile, targetDbFile);
    console.log(`✅ Đã đồng bộ bản sao sang: ${targetDbFile}`);
  }

  console.log('\n🎉 HOÀN TẤT XUẤT CƠ SỞ DỮ LIỆU VÀO /DATA!');
  process.exit(0);
}

exportDatabase().catch(err => {
  console.error('❌ Lỗi khi xuất database:', err);
  process.exit(1);
});
