/**
 * Power Rule & Benchmark Evaluator
 * Manages CPU/GPU performance benchmarks, bottleneck calculations,
 * TDP estimation, and dynamic performance/power advice generation.
 */

import { getPsuWattage } from "./heuristic-specs.parser";

export interface GpuBenchmarkEntry {
  patterns: string[];
  tier: number;
  tdp: number;
  vram: number;
  aaaFps1080p: number;
  aasFps1440p: number;
  esportsFps: number;
  renderScore: number;
}

export interface CpuPerfEntry {
  patterns: string[];
  singleCore: number;
  multiCore: number;
  tdp: number;
  cores: number;
}

export interface BottleneckResult {
  percent: number;
  bottleneckSide: "CPU" | "GPU" | "Balanced";
  label: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────────
// GPU Benchmark Tier Database
// Sources: TechPowerUp GPU Hierarchy, Digital Foundry, Tom's Hardware
// FPS values: 1080p High/Ultra averaged across Cyberpunk 2077, Wukong, SOTTR, F1
// ─────────────────────────────────────────────────────────────────────────
export const GPU_BENCHMARK_DB: GpuBenchmarkEntry[] = [
  // ── NVIDIA Ada Lovelace (RTX 40-series) ──
  { patterns: ["4090"],           tier: 10, tdp: 450, vram: 24, aaaFps1080p: 170, aasFps1440p: 130, esportsFps: 380, renderScore: 100 },
  { patterns: ["4080 super"],     tier: 9,  tdp: 320, vram: 16, aaaFps1080p: 148, aasFps1440p: 115, esportsFps: 340, renderScore: 87  },
  { patterns: ["4080"],           tier: 9,  tdp: 320, vram: 16, aaaFps1080p: 138, aasFps1440p: 108, esportsFps: 320, renderScore: 83  },
  { patterns: ["4070 ti super"],  tier: 8,  tdp: 285, vram: 16, aaaFps1080p: 128, aasFps1440p: 100, esportsFps: 305, renderScore: 75  },
  { patterns: ["4070 ti"],        tier: 8,  tdp: 285, vram: 12, aaaFps1080p: 118, aasFps1440p: 92,  esportsFps: 290, renderScore: 70  },
  { patterns: ["4070 super"],     tier: 7,  tdp: 220, vram: 12, aaaFps1080p: 108, aasFps1440p: 84,  esportsFps: 270, renderScore: 63  },
  { patterns: ["4070"],           tier: 7,  tdp: 200, vram: 12, aaaFps1080p: 98,  aasFps1440p: 76,  esportsFps: 255, renderScore: 58  },
  { patterns: ["4060 ti 16"],     tier: 6,  tdp: 165, vram: 16, aaaFps1080p: 85,  aasFps1440p: 65,  esportsFps: 225, renderScore: 50  },
  { patterns: ["4060 ti"],        tier: 6,  tdp: 160, vram: 8,  aaaFps1080p: 82,  aasFps1440p: 62,  esportsFps: 218, renderScore: 48  },
  { patterns: ["4060"],           tier: 5,  tdp: 115, vram: 8,  aaaFps1080p: 72,  aasFps1440p: 54,  esportsFps: 195, renderScore: 40  },
  // ── NVIDIA Ampere (RTX 30-series) ──
  { patterns: ["3090 ti"],        tier: 9,  tdp: 450, vram: 24, aaaFps1080p: 145, aasFps1440p: 118, esportsFps: 330, renderScore: 90  },
  { patterns: ["3090"],           tier: 9,  tdp: 350, vram: 24, aaaFps1080p: 135, aasFps1440p: 108, esportsFps: 305, renderScore: 85  },
  { patterns: ["3080 ti"],        tier: 8,  tdp: 350, vram: 12, aaaFps1080p: 128, aasFps1440p: 100, esportsFps: 295, renderScore: 78  },
  { patterns: ["3080 12"],        tier: 8,  tdp: 350, vram: 12, aaaFps1080p: 122, aasFps1440p: 96,  esportsFps: 285, renderScore: 74  },
  { patterns: ["3080"],           tier: 8,  tdp: 320, vram: 10, aaaFps1080p: 118, aasFps1440p: 92,  esportsFps: 278, renderScore: 72  },
  { patterns: ["3070 ti"],        tier: 7,  tdp: 290, vram: 8,  aaaFps1080p: 105, aasFps1440p: 82,  esportsFps: 255, renderScore: 62  },
  { patterns: ["3070"],           tier: 7,  tdp: 220, vram: 8,  aaaFps1080p: 98,  aasFps1440p: 75,  esportsFps: 245, renderScore: 58  },
  { patterns: ["3060 ti"],        tier: 6,  tdp: 200, vram: 8,  aaaFps1080p: 88,  aasFps1440p: 66,  esportsFps: 228, renderScore: 50  },
  { patterns: ["3060 12"],        tier: 5,  tdp: 170, vram: 12, aaaFps1080p: 74,  aasFps1440p: 56,  esportsFps: 200, renderScore: 42  },
  { patterns: ["3060"],           tier: 5,  tdp: 170, vram: 8,  aaaFps1080p: 72,  aasFps1440p: 54,  esportsFps: 196, renderScore: 41  },
  { patterns: ["3050"],           tier: 4,  tdp: 130, vram: 8,  aaaFps1080p: 58,  aasFps1440p: 42,  esportsFps: 168, renderScore: 30  },
  // ── NVIDIA Turing (RTX 20 / GTX 16-series) ──
  { patterns: ["2080 ti"],        tier: 7,  tdp: 260, vram: 11, aaaFps1080p: 95,  aasFps1440p: 72,  esportsFps: 240, renderScore: 56  },
  { patterns: ["2080 super","2080s"],tier:7, tdp: 250, vram: 8,  aaaFps1080p: 88,  aasFps1440p: 66,  esportsFps: 228, renderScore: 52  },
  { patterns: ["2070 super","2070s"],tier:6, tdp: 215, vram: 8,  aaaFps1080p: 79,  aasFps1440p: 60,  esportsFps: 210, renderScore: 46  },
  { patterns: ["2060 super","2060s"],tier:5, tdp: 175, vram: 8,  aaaFps1080p: 68,  aasFps1440p: 51,  esportsFps: 188, renderScore: 38  },
  { patterns: ["2060"],           tier: 5,  tdp: 160, vram: 6,  aaaFps1080p: 62,  aasFps1440p: 46,  esportsFps: 175, renderScore: 34  },
  { patterns: ["1660 super","1660s","1660 ti"], tier:4, tdp:125, vram:6, aaaFps1080p:55, aasFps1440p:38, esportsFps:158, renderScore:26 },
  { patterns: ["1660"],           tier: 4,  tdp: 120, vram: 6,  aaaFps1080p: 50,  aasFps1440p: 35,  esportsFps: 148, renderScore: 23  },
  { patterns: ["1650 super"],     tier: 3,  tdp: 100, vram: 4,  aaaFps1080p: 45,  aasFps1440p: 30,  esportsFps: 138, renderScore: 18  },
  { patterns: ["1650"],           tier: 3,  tdp:  75, vram: 4,  aaaFps1080p: 40,  aasFps1440p: 27,  esportsFps: 125, renderScore: 15  },
  // ── AMD RDNA 3 (RX 7000-series) ──
  { patterns: ["7900 xtx"],       tier: 10, tdp: 355, vram: 24, aaaFps1080p: 158, aasFps1440p: 125, esportsFps: 360, renderScore: 92  },
  { patterns: ["7900 xt"],        tier: 9,  tdp: 315, vram: 20, aaaFps1080p: 142, aasFps1440p: 112, esportsFps: 330, renderScore: 82  },
  { patterns: ["7900 gre"],       tier: 8,  tdp: 260, vram: 16, aaaFps1080p: 128, aasFps1440p: 100, esportsFps: 300, renderScore: 74  },
  { patterns: ["7800 xt"],        tier: 7,  tdp: 263, vram: 16, aaaFps1080p: 108, aasFps1440p: 84,  esportsFps: 270, renderScore: 62  },
  { patterns: ["7700 xt"],        tier: 6,  tdp: 245, vram: 12, aaaFps1080p: 90,  aasFps1440p: 68,  esportsFps: 235, renderScore: 52  },
  { patterns: ["7700"],           tier: 6,  tdp: 245, vram: 12, aaaFps1080p: 86,  aasFps1440p: 65,  esportsFps: 225, renderScore: 50  },
  { patterns: ["7600 xt"],        tier: 5,  tdp: 190, vram: 16, aaaFps1080p: 76,  aasFps1440p: 56,  esportsFps: 205, renderScore: 43  },
  { patterns: ["7600"],           tier: 5,  tdp: 165, vram: 8,  aaaFps1080p: 72,  aasFps1440p: 52,  esportsFps: 195, renderScore: 40  },
  // ── AMD RDNA 2 (RX 6000-series) ──
  { patterns: ["6950 xt"],        tier: 9,  tdp: 335, vram: 16, aaaFps1080p: 130, aasFps1440p: 103, esportsFps: 308, renderScore: 76  },
  { patterns: ["6900 xt"],        tier: 9,  tdp: 300, vram: 16, aaaFps1080p: 125, aasFps1440p: 98,  esportsFps: 295, renderScore: 73  },
  { patterns: ["6800 xt"],        tier: 8,  tdp: 300, vram: 16, aaaFps1080p: 118, aasFps1440p: 92,  esportsFps: 280, renderScore: 68  },
  { patterns: ["6800"],           tier: 7,  tdp: 250, vram: 16, aaaFps1080p: 105, aasFps1440p: 82,  esportsFps: 258, renderScore: 61  },
  { patterns: ["6750 xt"],        tier: 6,  tdp: 250, vram: 12, aaaFps1080p: 90,  aasFps1440p: 68,  esportsFps: 235, renderScore: 52  },
  { patterns: ["6700 xt"],        tier: 6,  tdp: 230, vram: 12, aaaFps1080p: 86,  aasFps1440p: 65,  esportsFps: 225, renderScore: 50  },
  { patterns: ["6700"],           tier: 6,  tdp: 175, vram: 10, aaaFps1080p: 80,  aasFps1440p: 60,  esportsFps: 215, renderScore: 46  },
  { patterns: ["6650 xt"],        tier: 5,  tdp: 180, vram: 8,  aaaFps1080p: 72,  aasFps1440p: 52,  esportsFps: 198, renderScore: 41  },
  { patterns: ["6600 xt"],        tier: 5,  tdp: 160, vram: 8,  aaaFps1080p: 70,  aasFps1440p: 50,  esportsFps: 192, renderScore: 39  },
  { patterns: ["6600"],           tier: 5,  tdp: 132, vram: 8,  aaaFps1080p: 65,  aasFps1440p: 46,  esportsFps: 182, renderScore: 36  },
  { patterns: ["6500 xt"],        tier: 3,  tdp: 107, vram: 4,  aaaFps1080p: 48,  aasFps1440p: 32,  esportsFps: 145, renderScore: 22  },
  // ── Intel Arc ──
  { patterns: ["arc a770"],       tier: 6,  tdp: 225, vram: 16, aaaFps1080p: 78,  aasFps1440p: 58,  esportsFps: 205, renderScore: 42  },
  { patterns: ["arc a750"],       tier: 5,  tdp: 225, vram: 8,  aaaFps1080p: 70,  aasFps1440p: 52,  esportsFps: 190, renderScore: 38  },
  { patterns: ["arc a580"],       tier: 4,  tdp: 185, vram: 8,  aaaFps1080p: 58,  aasFps1440p: 40,  esportsFps: 165, renderScore: 28  },
];

// CPU Performance Database — Cinebench R23 single/multi-core normalized (100 = i9-14900K)
export const CPU_PERF_DB: CpuPerfEntry[] = [
  // Intel 14th / 13th / 12th gen
  { patterns: ["14900ks"],                        singleCore: 104, multiCore: 100, tdp: 253, cores: 24 },
  { patterns: ["14900k","14900kf"],               singleCore: 100, multiCore: 96,  tdp: 253, cores: 24 },
  { patterns: ["13900ks"],                        singleCore: 102, multiCore: 97,  tdp: 253, cores: 24 },
  { patterns: ["13900k","13900kf"],               singleCore: 98,  multiCore: 93,  tdp: 253, cores: 24 },
  { patterns: ["14700k","14700kf"],               singleCore: 95,  multiCore: 88,  tdp: 253, cores: 20 },
  { patterns: ["13700k","13700kf"],               singleCore: 92,  multiCore: 84,  tdp: 253, cores: 16 },
  { patterns: ["12900ks","12900k"],               singleCore: 94,  multiCore: 85,  tdp: 241, cores: 16 },
  { patterns: ["12700k","12700kf"],               singleCore: 90,  multiCore: 76,  tdp: 190, cores: 12 },
  { patterns: ["14600k","14600kf"],               singleCore: 90,  multiCore: 72,  tdp: 181, cores: 14 },
  { patterns: ["13600k","13600kf"],               singleCore: 88,  multiCore: 70,  tdp: 181, cores: 14 },
  { patterns: ["14400f","14400"],                 singleCore: 82,  multiCore: 58,  tdp: 148, cores: 10 },
  { patterns: ["13400f","13400"],                 singleCore: 80,  multiCore: 57,  tdp: 148, cores: 10 },
  { patterns: ["12600k","12600kf"],               singleCore: 82,  multiCore: 62,  tdp: 150, cores: 10 },
  { patterns: ["12400f","12400"],                 singleCore: 75,  multiCore: 50,  tdp: 117, cores: 6  },
  { patterns: ["14100f","14100"],                 singleCore: 75,  multiCore: 42,  tdp: 110, cores: 4  },
  { patterns: ["13100f","13100"],                 singleCore: 72,  multiCore: 40,  tdp: 110, cores: 4  },
  { patterns: ["12100f","12100"],                 singleCore: 70,  multiCore: 38,  tdp: 89,  cores: 4  },
  { patterns: ["11400f","11400"],                 singleCore: 68,  multiCore: 46,  tdp: 65,  cores: 6  },
  { patterns: ["10400f","10400"],                 singleCore: 60,  multiCore: 38,  tdp: 65,  cores: 6  },
  { patterns: ["10100f","10100"],                 singleCore: 56,  multiCore: 28,  tdp: 65,  cores: 4  },
  { patterns: ["i9-9900k","i9 9900k","9900k"],    singleCore: 68,  multiCore: 48,  tdp: 95,  cores: 8  },
  // AMD Ryzen 9000/8000/7000 Zen 4/5
  { patterns: ["9950x","7950x3d"],                singleCore: 100, multiCore: 105, tdp: 170, cores: 16 },
  { patterns: ["9900x","7950x"],                  singleCore: 98,  multiCore: 98,  tdp: 170, cores: 16 },
  { patterns: ["9700x","7900x3d"],                singleCore: 96,  multiCore: 86,  tdp: 120, cores: 12 },
  { patterns: ["9600x","7900x"],                  singleCore: 94,  multiCore: 80,  tdp: 170, cores: 12 },
  { patterns: ["7800x3d"],                        singleCore: 95,  multiCore: 72,  tdp: 120, cores: 8  },
  { patterns: ["7700x","7700"],                   singleCore: 90,  multiCore: 68,  tdp: 105, cores: 8  },
  { patterns: ["7600x","7600"],                   singleCore: 88,  multiCore: 58,  tdp: 105, cores: 6  },
  { patterns: ["7500f"],                          singleCore: 85,  multiCore: 52,  tdp: 65,  cores: 6  },
  { patterns: ["8700g"],                          singleCore: 90,  multiCore: 75,  tdp: 65,  cores: 8  },
  { patterns: ["8600g"],                          singleCore: 88,  multiCore: 62,  tdp: 65,  cores: 6  },
  // AMD Ryzen 5000 / 3000 Zen 2/3
  { patterns: ["5950x"],                          singleCore: 84,  multiCore: 90,  tdp: 105, cores: 16 },
  { patterns: ["5900x"],                          singleCore: 82,  multiCore: 82,  tdp: 105, cores: 12 },
  { patterns: ["5800x3d"],                        singleCore: 86,  multiCore: 66,  tdp: 105, cores: 8  },
  { patterns: ["5700x3d"],                        singleCore: 82,  multiCore: 63,  tdp: 105, cores: 8  },
  { patterns: ["5800x"],                          singleCore: 81,  multiCore: 63,  tdp: 105, cores: 8  },
  { patterns: ["5700x","5700g"],                  singleCore: 78,  multiCore: 58,  tdp: 65,  cores: 8  },
  { patterns: ["5600x","5600"],                   singleCore: 78,  multiCore: 52,  tdp: 65,  cores: 6  },
  { patterns: ["5500"],                           singleCore: 72,  multiCore: 46,  tdp: 65,  cores: 6  },
  { patterns: ["3600x","3600"],                   singleCore: 64,  multiCore: 45,  tdp: 65,  cores: 6  },
  { patterns: ["4500","4100"],                    singleCore: 58,  multiCore: 35,  tdp: 65,  cores: 6  },
];

/**
 * Estimate FPS & specs from GPU name using the benchmark database.
 * Falls back to conservative mid-range values if GPU not identified.
 */
export function estimateFpsFromGpuName(gpuNameLower: string): {
  aaaFps: number; esportsFps: number; aasFps1440p: number; tier: number; tdp: number; vram: number; renderScore: number;
} {
  for (const entry of GPU_BENCHMARK_DB) {
    if (entry.patterns.some(p => gpuNameLower.includes(p))) {
      return {
        aaaFps: entry.aaaFps1080p,
        esportsFps: entry.esportsFps,
        aasFps1440p: entry.aasFps1440p,
        tier: entry.tier,
        tdp: entry.tdp,
        vram: entry.vram,
        renderScore: entry.renderScore,
      };
    }
  }
  // Unknown GPU — conservative mid-range default
  return { aaaFps: 60, esportsFps: 160, aasFps1440p: 42, tier: 4, tdp: 150, vram: 8, renderScore: 30 };
}

/** Match CPU name and return performance metrics. */
export function estimateCpuPerf(cpuNameLower: string): { singleCore: number; multiCore: number; tdp: number; cores: number } {
  for (const entry of CPU_PERF_DB) {
    if (entry.patterns.some(p => cpuNameLower.includes(p))) {
      return entry;
    }
  }
  return { singleCore: 70, multiCore: 50, tdp: 95, cores: 6 };
}

/**
 * Calculate bottleneck percentage between CPU and GPU at a given resolution.
 * Result clamped 1–38%. <=5%=optimal, 6–12%=acceptable, >12%=noticeable.
 */
export function calculateBottleneck(
  cpuName: string,
  gpuName: string,
  resolution: "1080p" | "1440p" | "4K" = "1080p"
): BottleneckResult {
  const cpuPerf = estimateCpuPerf(cpuName.toLowerCase());
  const gpuData = estimateFpsFromGpuName(gpuName.toLowerCase());

  const resolutionFactor = resolution === "1080p" ? 1.0 : resolution === "1440p" ? 0.65 : 0.35;
  
  // Core penalty: Modern games require at least 6 cores; 4-core CPUs starve draw calls for flagship GPUs
  const coreFactor = cpuPerf.cores < 6 ? 0.82 : cpuPerf.cores >= 8 ? 1.05 : 1.0;
  const cpuEffective = Math.min(105, Math.round(cpuPerf.singleCore * coreFactor));
  const gpuDemand = Math.round(gpuData.tier * 9.5); // Tier 10 -> 95, Tier 9 -> 85, Tier 7 -> 66, Tier 3 -> 28

  const rawDiff = (gpuDemand - cpuEffective) * resolutionFactor;

  let bottleneckPercent: number;
  let bottleneckSide: "CPU" | "GPU" | "Balanced";

  if (rawDiff > 6) {
    bottleneckPercent = Math.min(38, Math.round(rawDiff * 0.85));
    bottleneckSide = "CPU";
  } else if (rawDiff < -8) {
    bottleneckPercent = Math.min(35, Math.round(Math.abs(rawDiff) * 0.45));
    bottleneckSide = "GPU";
  } else {
    bottleneckPercent = Math.max(1, Math.round(Math.abs(rawDiff) * 0.3 + 2));
    bottleneckSide = "Balanced";
  }

  let label: string;
  let detail: string;
  if (bottleneckPercent <= 5) {
    label = "⚡ Rất Tối Ưu";
    detail = `CPU và GPU phối hợp hoàn hảo. GPU vận hành ~100% công suất tại ${resolution}.`;
  } else if (bottleneckPercent <= 12) {
    label = "✅ Chấp Nhận Được";
    detail = `Chênh lệch nhỏ, trải nghiệm chơi game ổn định tại ${resolution}.`;
  } else if (bottleneckPercent <= 20) {
    label = "⚠️ Cần Chú Ý";
    detail = bottleneckSide === "CPU"
      ? `CPU bắt đầu kìm hãm GPU tại ${resolution}. Cân nhắc CPU nhiều nhân/xung cao hơn.`
      : `GPU là nút thắt tại ${resolution}. Nâng GPU để khai thác hết sức mạnh CPU.`;
  } else {
    label = "🔴 Mất Cân Bằng";
    detail = bottleneckSide === "CPU"
      ? `CPU quá yếu so với GPU — ước tính ~${bottleneckPercent}% sức mạnh GPU bị nghẽn tại ${resolution}.`
      : `GPU quá yếu so với CPU — CPU dư tải lớn, nên cân nhắc nâng cấp GPU.`;
  }
  return { percent: bottleneckPercent, bottleneckSide, label, detail };
}

/** Estimate system peak TDP: CPU + GPU * 1.15 + 65W overhead (MB/RAM/SSD/fans). */
export function estimateSystemTdp(cpuTdp: number, gpuTdp: number): { idleW: number; peakW: number } {
  const overhead = 65;
  return {
    peakW: Math.round((cpuTdp + gpuTdp) * 1.15 + overhead),
    idleW: Math.round(overhead + cpuTdp * 0.25 + gpuTdp * 0.15),
  };
}

/**
 * Generate human-readable technical rationale for candidate components
 */
export function generateComponentExplanation(
  type: string,
  item: { name: string; price: number },
  totalBudget: number,
  _ratio: number,
  useCase: string = "gaming"
): string {
  const name = item.name || "Linh kiện";
  const nameLower = name.toLowerCase();
  const percent = Math.round((item.price / Math.max(1, totalBudget)) * 100);

  switch (type.toLowerCase()) {
    case "cpu":
      if (nameLower.includes("i9") || nameLower.includes("7950x") || nameLower.includes("14900")) {
        return `CPU ${name}: Chọn vì sức mạnh xử lý đa nhân cực mạnh (${percent}% ngân sách), phục vụ tối ưu cho Render 4K/3D và Gaming đỉnh cao.`;
      }
      if (nameLower.includes("i7") || nameLower.includes("7800x3d") || nameLower.includes("13700")) {
        return `CPU ${name}: Chọn vì hiệu năng Gaming & Đồ họa cao cấp (${percent}% ngân sách), duy trì xung nhịp ổn định không lo giật lag.`;
      }
      return `CPU ${name}: Chọn vì cân bằng giá/hiệu năng tuyệt vời (${percent}% ngân sách), đáp ứng hoàn hảo nhu cầu ${useCase.toUpperCase()} và dễ dàng nâng cấp.`;

    case "gpu":
      if (nameLower.includes("4090") || nameLower.includes("4080") || nameLower.includes("7900 xtx")) {
        return `GPU ${name}: Trái tim của hệ thống (${percent}% ngân sách), sức mạnh đồ họa đỉnh bảng cân mượt mọi game AAA ở 4K Max Settings & Ray Tracing.`;
      }
      if (nameLower.includes("4070") || nameLower.includes("7800 xt") || nameLower.includes("3070")) {
        return `GPU ${name}: Động cơ đồ họa chính (${percent}% ngân sách), chiến mượt mà các tựa game 2K/1080p High FPS và tăng tốc render video.`;
      }
      return `GPU ${name}: Chọn vì tối ưu chi phí (${percent}% ngân sách), xử lý mượt các game eSports phổ biến và xuất hình ảnh độ phân giải cao.`;

    case "mainboard":
      if (nameLower.includes("z790") || nameLower.includes("x670") || nameLower.includes("z690")) {
        return `Mainboard ${name}: Bo mạch chủ phân khúc cao cấp (${percent}% ngân sách), dàn VRM xịn cấp điện ổn định và hỗ trợ ép xung mạnh mẽ.`;
      }
      if (nameLower.includes("b760") || nameLower.includes("b650") || nameLower.includes("b550")) {
        return `Mainboard ${name}: Lựa chọn quốc dân (${percent}% ngân sách), trang bị đầy đủ khe M.2 NVMe, PCIe 4.0/5.0 và hỗ trợ nâng cấp phần cứng.`;
      }
      return `Mainboard ${name}: Tối ưu chi phí (${percent}% ngân sách), chân cắm linh hoạt, vận hành bền bỉ cho toàn hệ thống.`;

    case "ram":
      if (nameLower.includes("32gb") || nameLower.includes("64gb")) {
        return `RAM ${name}: Dung lượng bộ nhớ dồi dào (${percent}% ngân sách), đảm bảo đa nhiệm mượt mà không lo đầy RAM khi dựng phim hay vừa chơi game vừa live stream.`;
      }
      return `RAM ${name}: Chọn vì đáp ứng đủ chuẩn bộ nhớ (${percent}% ngân sách), tốc độ bus mượt mà cho các tác vụ hàng ngày.`;

    case "psu":
      if (nameLower.includes("850") || nameLower.includes("1000") || nameLower.includes("gold")) {
        return `Nguồn ${name}: Công suất thực mạnh mẽ (${percent}% ngân sách), chuẩn 80 Plus Gold dư tải an toàn > 25% giúp bảo vệ linh kiện.`;
      }
      return `Nguồn ${name}: Cấp điện ổn định (${percent}% ngân sách), đáp ứng tốt tổng công suất tiêu thụ của CPU & GPU.`;

    case "cooling":
      if (nameLower.includes("360") || nameLower.includes("aio") || nameLower.includes("240")) {
        return `Tản nhiệt ${name}: Giải pháp tản nhiệt nước AIO (${percent}% ngân sách), giữ CPU luôn mát mẻ < 75°C khi chơi game full load.`;
      }
      return `Tản nhiệt ${name}: Tản nhiệt tháp khí hiệu năng cao (${percent}% ngân sách), độ ồn thấp và duy trì nhiệt độ tối ưu.`;

    case "storage":
      return `Ổ cứng ${name}: Ổ SSD NVMe tốc độ cao (${percent}% ngân sách), giúp khởi động Windows và load game chỉ trong vài giây.`;

    case "case":
      return `Vỏ Case ${name}: Thiết kế thoáng khí (${percent}% ngân sách), luồng gió tối ưu và không gian rộng rãi chứa vừa vặn các linh kiện.`;

    default:
      return `${name}: Được lựa chọn tối ưu theo tỷ lệ ngân sách ${percent}%.`;
  }
}

/**
 * Generate technical rule-based advice for AI advisor fallback
 */
export function generateRuleBasedAdvice(
  question: string,
  items: any[],
  totalPrice: number,
  buildContext: any,
  recommendedBuild?: any
): string {
  const qLower = question.toLowerCase();
  const cpu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "CPU") || recommendedBuild?.components?.cpu;
  const gpu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "GPU") || recommendedBuild?.components?.gpu;
  const ram = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "RAM") || recommendedBuild?.components?.ram;
  const psu = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "PSU") || recommendedBuild?.components?.psu;
  const cooling = items.find((i: any) => String(i.type || i.componentType).toUpperCase() === "COOLING") || recommendedBuild?.components?.cooling;
  const formatVND = (v: number) => Number(v || 0).toLocaleString("vi-VN") + "đ";

  const cpuName = cpu?.name || cpu?.productName || "CPU hiện tại";
  const gpuName = gpu?.name || gpu?.productName || "";

  // ── 1. Bottleneck Analysis — Real Engine ──
  if (qLower.includes("nghẽn") || qLower.includes("bottleneck") || qLower.includes("thắt cổ chai")) {
    const cpuPerf = estimateCpuPerf(cpuName.toLowerCase());
    const gpuData = estimateFpsFromGpuName(gpuName.toLowerCase());
    const bn1080 = calculateBottleneck(cpuName, gpuName, "1080p");
    const bn1440 = calculateBottleneck(cpuName, gpuName, "1440p");
    const bn4K   = calculateBottleneck(cpuName, gpuName, "4K");

    const upgradeAdvice = bn1080.bottleneckSide === "CPU" && bn1080.percent > 12
      ? `\n> 💡 **Khuyến nghị**: Nâng cấp CPU hoặc ép xung để GPU **${gpuName}** hoạt động 100% công suất.`
      : bn1080.bottleneckSide === "GPU" && bn1080.percent > 12
      ? `\n> 💡 **Khuyến nghị**: Nâng cấp GPU để tận dụng tối đa sức mạnh CPU **${cpuName}**.`
      : `\n> 💡 **Kết luận**: Cặp CPU-GPU này phối hợp xuất sắc — không cần nâng cấp ngay.`;

    return `📊 **Phân Tích Cân Bằng & Thắt Cổ Chai (Bottleneck Analysis)**

**Cặp linh kiện:** ${cpuName} ↔ ${gpuName || "(chưa chọn GPU)"}

| Độ Phân Giải | Bottleneck | Nút Thắt | Đánh Giá |
|:---:|:---:|:---:|:---|
| 1080p | **${bn1080.percent}%** | ${bn1080.bottleneckSide} | ${bn1080.label} |
| 1440p | **${bn1440.percent}%** | ${bn1440.bottleneckSide} | ${bn1440.label} |
| 4K    | **${bn4K.percent}%**   | ${bn4K.bottleneckSide}   | ${bn4K.label}   |

📌 ${bn1080.detail}
- **CPU**: ${cpuPerf.singleCore}/100 đơn nhân · ${cpuPerf.multiCore}/100 đa nhân · ${cpuPerf.cores} cores · TDP ${cpuPerf.tdp}W
- **GPU**: Tier ${gpuData.tier}/10 · VRAM ${gpuData.vram}GB · TDP ${gpuData.tdp}W${upgradeAdvice}`;
  }

  // ── 2. PSU / Power Analysis — Real TDP Engine ──
  if (qLower.includes("nguồn") || qLower.includes("điện") || qLower.includes("psu") || qLower.includes("cháy") || qLower.includes("watt") || qLower.includes("kéo nổi") || qLower.includes("gánh")) {
    const cpuPerf  = estimateCpuPerf(cpuName.toLowerCase());
    const gpuData  = estimateFpsFromGpuName(gpuName.toLowerCase());
    const sysTdp   = estimateSystemTdp(cpuPerf.tdp, gpuData.tdp);
    const psuName  = psu?.name || "Bộ nguồn đã chọn";
    const psuWatt  = getPsuWattage(psu);
    const headroom = psuWatt - sysTdp.peakW;
    const headroomPct = Math.round((headroom / psuWatt) * 100);
    const psuStatus = headroom > 100
      ? `✅ An Toàn (Dự Phòng ${headroomPct}%)`
      : headroom > 30
      ? `⚠️ Vừa Đủ (Dự Phòng ${headroomPct}% — Cân nhắc PSU công suất cao hơn)`
      : `🔴 NGUY HIỂM — PSU có thể không đủ tải (chỉ còn ${headroom}W dự phòng)`;

    return `⚡ **Phân Tích Nguồn & Điện Năng (PSU Load Analysis)**

- **CPU**: ${cpuName} → TDP ${cpuPerf.tdp}W
- **GPU**: ${gpuName || "(chưa chọn)"} → TDP ${gpuData.tdp}W
- **Tổng Hệ Thống (ước tính)**: Idle ~${sysTdp.idleW}W · Full Load ~${sysTdp.peakW}W
- **Bộ Nguồn**: ${psuName} (${psuWatt}W) → ${psuStatus}

> 💡 Khuyến nghị: PSU **≥ ${Math.ceil((sysTdp.peakW + 100) / 50) * 50}W** 80+ Gold để bảo vệ linh kiện dài lâu.`;
  }

  // ── 3. Thermal Analysis ──
  if (qLower.includes("tản") || qLower.includes("nhiệt") || qLower.includes("nóng") || qLower.includes("aio") || qLower.includes("quạt")) {
    const cpuPerf  = estimateCpuPerf(cpuName.toLowerCase());
    const coolName = cooling?.name || "Tản nhiệt đã chọn";
    const coolType = String(cooling?.specs?.["loại tản nhiệt"] || cooling?.specs?.["cooling_type"] || "").toLowerCase();
    const radSize = String(cooling?.specs?.["kích thước tản / radiator"] || cooling?.specs?.["kích thước radiator"] || cooling?.specs?.["radiator_size"] || "");
    const coolNameLower = String(coolName).toLowerCase();
    const isAio = coolType.includes("nước") || coolType.includes("aio") || coolNameLower.includes("aio") || coolNameLower.includes("liquid");
    const aioSize = radSize.includes("360") || coolNameLower.includes("360") ? "360mm"
      : radSize.includes("280") || coolNameLower.includes("280") ? "280mm"
      : radSize.includes("240") || coolNameLower.includes("240") ? "240mm"
      : (radSize || "AIO");
    const coolingNote = isAio
      ? `AIO ${aioSize} — Rất hiệu quả, giữ CPU ~${Math.max(60, 95 - Math.round(cpuPerf.tdp / 10))}°C khi full load.`
      : cpuPerf.tdp > 150
      ? `Tản khí với CPU TDP ${cpuPerf.tdp}W — Khuyến nghị AIO 240mm+ hoặc Tower 5 ống nhiệt (Noctua NH-D15, DeepCool Assassin).`
      : `Tản khí phù hợp với CPU TDP ${cpuPerf.tdp}W.`;

    return `🌡️ **Phân Tích Giải Nhiệt & Luồng Gió (Thermal Analysis)**

- **CPU**: ${cpuName} — TDP ${cpuPerf.tdp}W (${cpuPerf.cores} cores)
- **Bộ Làm Mát**: ${coolName} (${formatVND(cooling?.price || 0)}) — ${coolingNote}

**Khuyến nghị luồng gió:** Hút trước 2 quạt → Đẩy sau 1 → Đẩy nóc (nếu AIO 360).
> 💡 CPU TDP ${cpuPerf.tdp}W → Dùng ${cpuPerf.tdp > 150 ? "AIO 240mm trở lên hoặc Tower 5HP" : cpuPerf.tdp > 95 ? "Tower 4HP hoặc AIO 120mm" : "tản đi kèm hoặc tản khí cơ bản"} là phù hợp.`;
  }

  // ── 4. Gaming FPS — Real Benchmark Engine ──
  if (qLower.includes("wukong") || qLower.includes("gta") || qLower.includes("valorant") || qLower.includes("cs2") || qLower.includes("game") || qLower.includes("fps") || qLower.includes("chơi")) {
    const gpuData  = estimateFpsFromGpuName(gpuName.toLowerCase());
    const bn1080   = calculateBottleneck(cpuName, gpuName, "1080p");
    const bn1440   = calculateBottleneck(cpuName, gpuName, "1440p");
    const cpuFactor = bn1080.bottleneckSide === "CPU" ? Math.max(0.70, 1 - bn1080.percent / 100) : 1.0;

    const adj1080 = Math.round(gpuData.aaaFps * cpuFactor);
    const adj1440 = Math.round(gpuData.aasFps1440p * cpuFactor);
    const adjESP  = Math.round(gpuData.esportsFps * cpuFactor);

    const wukongFps    = Math.round(adj1080 * 0.78);
    const cs2Fps       = Math.min(Math.round(adjESP * 1.05), 500);
    const valorantFps  = Math.min(Math.round(adjESP * 0.95), 500);
    const gtavFps      = Math.round(adj1080 * 1.12);
    const cyberpunkFps = Math.round(adj1080 * 0.68);
    const totalText    = formatVND(recommendedBuild?.totalPrice || totalPrice);
    const resTarget    = gpuData.tier >= 8 ? "2K/1440p" : gpuData.tier >= 5 ? "1080p" : "1080p (Medium)";

    return `🎮 **Phân Tích Hiệu Năng Gaming — Benchmark Thực Tế**

**Cấu hình:** ${cpuName} + ${gpuName || "(chưa chọn GPU)"} · Tổng: **${totalText}**
**GPU Tier:** ${gpuData.tier}/10 · VRAM ${gpuData.vram}GB · Mục tiêu: **${resTarget}**
**Bottleneck:** 1080p=${bn1080.percent}% (${bn1080.bottleneckSide}) · 1440p=${bn1440.percent}%

| Game | 1080p Avg FPS | 1440p Avg FPS | Nhận Xét |
|---|:---:|:---:|---|
| 🐒 Black Myth: Wukong | **${wukongFps}** | **${Math.round(wukongFps * 0.68)}** | Ultra/FSR Quality |
| 🔫 CS2 | **${cs2Fps}+** | **${Math.round(cs2Fps * 0.7)}** | Competitive Settings |
| ⚡ Valorant | **${valorantFps}+** | **${Math.round(valorantFps * 0.75)}** | High Settings |
| 🚗 GTA V | **${gtavFps}** | **${Math.round(gtavFps * 0.78)}** | Max Texture |
| 🌆 Cyberpunk 2077 | **${cyberpunkFps}** | **${Math.round(cyberpunkFps * 0.65)}** | Ultra (No RT) |

> ⚠️ *FPS tổng hợp từ TechPowerUp & Digital Foundry. Kết quả thực tế ±10% tùy driver/setting.*
> 💡 GPU Tier ${gpuData.tier}/10 — ${gpuData.tier >= 8 ? "Đủ mạnh chơi 4K với DLSS/FSR" : gpuData.tier >= 6 ? "1440p mượt, cân được 4K với upscaling" : gpuData.tier >= 4 ? "1080p High ổn định" : "1080p Medium — Cân nhắc nâng GPU"}`;
  }

  // ── 5. Creative / Render Analysis ──
  if (qLower.includes("render") || qLower.includes("dựng phim") || qLower.includes("video") || qLower.includes("3d") || qLower.includes("đồ họa") || qLower.includes("photoshop") || qLower.includes("premiere")) {
    const cpuPerf  = estimateCpuPerf(cpuName.toLowerCase());
    const gpuData  = estimateFpsFromGpuName(gpuName.toLowerCase());
    const renderIdx = Math.round(cpuPerf.multiCore * 0.6 + gpuData.renderScore * 0.4);
    const renderRating = renderIdx > 80 ? "🏆 Cấp Chuyên Nghiệp (Workstation-class)"
      : renderIdx > 60 ? "✅ Cấp Bán Chuyên (Studio độc lập)"
      : renderIdx > 40 ? "⚡ Cấp Khá (YouTuber / Freelancer)"
      : "📖 Cấp Cơ Bản (Học tập, dự án nhỏ)";

    return `🎬 **Phân Tích Hiệu Năng Đồ Họa & Dựng Phim**

- **CPU**: ${cpuName} — ${cpuPerf.cores} cores · Multi-core Score: ${cpuPerf.multiCore}/100
- **GPU**: ${gpuName || "(chưa chọn)"} — VRAM ${gpuData.vram}GB · Render Score: ${gpuData.renderScore}/100
- **RAM**: ${ram?.name || "(chưa chọn)"}
- **Chỉ Số Sáng Tạo Tổng Hợp**: **${renderIdx}/100** — ${renderRating}

**Hiệu năng ước tính:**
- 🎞️ Premiere/DaVinci 4K H.264: ${renderIdx > 70 ? "Rất nhanh (<1× realtime)" : renderIdx > 50 ? "Nhanh (1–2× realtime)" : "Bình thường (2–4× realtime)"}
- 🧊 Blender Cycles GPU: **${gpuData.renderScore}/100** so với RTX 4090
- 🖼️ VRAM ${gpuData.vram}GB: ${gpuData.vram >= 12 ? "✅ Thoải mái cho 4K timeline" : gpuData.vram >= 8 ? "⚡ Ổn" : "⚠️ Hơi hạn chế cho 4K"}

> 💡 CPU ${cpuPerf.cores} cores + VRAM ${gpuData.vram}GB là hai yếu tố quyết định với creative workload.`;
  }

  // ── 6. Build Overview ──
  if (recommendedBuild?.components) {
    const comps = recommendedBuild.components;
    const bTotal = formatVND(recommendedBuild.totalPrice);
    const bBudget = (Number(recommendedBuild.budget || 20000000) / 1000000).toFixed(0);
    const useCaseLabel = recommendedBuild.useCase === "office" ? "Học Tập & Văn Phòng" : recommendedBuild.useCase === "editing" ? "Đồ Họa & Dựng Phim" : "Gaming & Giải Trí";

    const compGpuName = comps.gpu?.name || "";
    const compCpuName = comps.cpu?.name || "";
    const gpuStats = compGpuName ? estimateFpsFromGpuName(compGpuName.toLowerCase()) : null;
    const bnResult = compGpuName && compCpuName ? calculateBottleneck(compCpuName, compGpuName, "1080p") : null;
    const perfLine = gpuStats
      ? `\n⚡ **Hiệu Năng**: GPU Tier ${gpuStats.tier}/10 · FPS AAA ~${gpuStats.aaaFps} · eSports ~${gpuStats.esportsFps}+${bnResult ? ` · Bottleneck ${bnResult.percent}% (${bnResult.bottleneckSide})` : ""}`
      : "";

    return `🎯 **Dàn PC AI Đề Xuất Tối Ưu (${bBudget} Triệu VNĐ • ${useCaseLabel})**:
- 🖥️ **CPU**: ${comps.cpu?.name || "CPU"} (${formatVND(comps.cpu?.price || 0)})
- 🔌 **Mainboard**: ${comps.mainboard?.name || "Mainboard"} (${formatVND(comps.mainboard?.price || 0)})
- 🧠 **RAM**: ${comps.ram ? `${comps.ram.name} (${formatVND(comps.ram.price)})` : "Đã có sẵn (0đ)"}
${comps.gpu ? `- 🎮 **GPU**: ${comps.gpu.name} (${formatVND(comps.gpu.price)})\n` : (recommendedBuild.useCase !== "office" ? "- 🎮 **GPU**: Đã có sẵn (0đ)\n" : "")}- 💾 **SSD**: ${comps.storage ? `${comps.storage.name} (${formatVND(comps.storage.price)})` : "Đã có sẵn (0đ)"}
- ⚡ **PSU**: ${comps.psu?.name || "PSU"} (${formatVND(comps.psu?.price || 0)})
- 📦 **Case**: ${comps.case?.name || "Case"} (${formatVND(comps.case?.price || 0)})
- ❄️ **Cooling**: ${comps.cooling?.name || "Tản nhiệt"} (${formatVND(comps.cooling?.price || 0)})${perfLine}
💰 **Tổng Giá Thực Tế Trong Kho**: **${bTotal}**
✨ **BUILD READY** — Socket, Điện Năng & CPU-GPU Balance đã được kiểm tra.
💡 Bấm **🚀 Tự Động Chọn & Nạp Dàn PC** để nạp linh kiện vào cấu hình!`;
  }

  return `🤖 **Tư vấn Tổng quan**: ${items.length} linh kiện đã chọn (Tổng: ${formatVND(totalPrice)}) — Tương thích **${buildContext.xaiScore || 100}%** (${buildContext.buildReadiness || "BUILD READY"}).`;
}
