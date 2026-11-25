const { spawn, execSync } = require("node:child_process");
const path = require("node:path");

console.log("\n=======================================================");
console.log("🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG PC MALL (FULL-STACK)");
console.log("   ➜ Frontend Web: http://localhost:5173");
console.log("   ➜ Backend API:  http://localhost:4000");
console.log("=======================================================\n");

const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const shellOption = process.platform === "win32" ? "cmd.exe" : true;

// 1. Tự động kích hoạt Docker MySQL nếu Docker đang chạy trên máy
try {
  execSync("docker compose up -d mysql || docker-compose up -d mysql", {
    cwd: rootDir,
    stdio: "ignore",
    shell: shellOption,
    timeout: 4000
  });
  console.log("📦 [Docker] Đã kích hoạt MySQL container (Cổng 3307).");
} catch (_e) {
  // Bỏ qua nếu Docker Desktop chưa mở (Backend vẫn khởi động và đợi DB)
}

// 2. Đảm bảo Prisma Client đã được sinh mã
try {
  execSync(`${npmCommand} run prisma:generate -w services/api`, {
    cwd: rootDir,
    stdio: "ignore"
  });
} catch (_e) {
  // Bỏ qua nếu đã có sẵn client
}

// 3. Khởi chạy đồng thời Backend và Frontend
const processes = [
  {
    command: npmCommand,
    args: ["run", "dev", "-w", "services/api"]
  },
  {
    command: npmCommand,
    args: ["run", "dev", "-w", "apps/web"]
  }
];

const children = processes.map((processConfig) =>
  spawn(processConfig.command, processConfig.args, {
    stdio: "inherit",
    shell: shellOption
  })
);

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
