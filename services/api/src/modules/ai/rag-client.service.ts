/**
 * 🌐 RAG CLIENT SERVICE (GATEWAY ADAPTER)
 * ==============================================================================
 * Cầu nối giữa Express Backend và Python AI Microservice (ChromaDB + Hybrid RRF).
 * Tuân thủ nguyên lý Fault-Tolerance:
 * - Nếu AI Microservice hoạt động: Tận dụng 100% sức mạnh Hybrid RAG (Dense + BM25 + Rules).
 * - Nếu AI Microservice bận hoặc khởi động lại: Tự động fallback về Local Heuristic DB.
 * ==============================================================================
 */

class RagClientService {
  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:5001";
  }

  /**
   * Truy vấn ngữ cảnh thực tế từ AI Service (Linh kiện, Quy tắc tương thích, Chính sách)
   * @param {string} query Câu hỏi người dùng
   * @param {number} topK Số lượng tài liệu tối đa
   * @param {string|null} docType Bộ lọc loại tài liệu ('product', 'compatibility_rule', 'store_policy', 'custom_document')
   * @returns {Promise<{ query: string, grounded_system_prompt: string, documents: Array } | null>}
   */
  async retrieve(query, topK = 4, docType = null) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) return null;

    try {
      const response = await fetch(`${this.baseUrl}/v1/rag/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          top_k: topK,
          doc_type: docType || undefined
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      return null;
    }
  }

  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==================== ADMIN DOCUMENT MANAGEMENT ====================

  async listDocuments() {
    const response = await fetch(`${this.baseUrl}/v1/rag/documents`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      throw new Error(`AI Service lỗi khi đọc danh sách tài liệu: ${response.statusText}`);
    }
    return await response.json();
  }

  async uploadDocument(fileBuffer, originalFilename, targetService = "all") {
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append("file", blob, originalFilename);
    formData.append("target_service", targetService);

    const response = await fetch(`${this.baseUrl}/v1/rag/documents/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(120000) // Cho phép 120s nếu file PDF nhiều trang cần tiền xử lý
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || "Không thể upload và vector hóa tài liệu.");
    }

    return await response.json();
  }

  async deleteDocument(filename) {
    const response = await fetch(`${this.baseUrl}/v1/rag/documents/${encodeURIComponent(filename)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || "Không thể xóa tài liệu từ AI Service.");
    }

    return await response.json();
  }

  async previewChunks(filename) {
    const response = await fetch(`${this.baseUrl}/v1/rag/documents/${encodeURIComponent(filename)}/chunks`, {
      method: "GET",
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || "Không thể xem chunks tài liệu.");
    }

    return await response.json();
  }

  async triggerReindex() {
    const response = await fetch(`${this.baseUrl}/v1/rag/reindex`, {
      method: "POST",
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error("Lỗi khi kích hoạt tái lập chỉ mục Vector DB.");
    }

    return await response.json();
  }

  async getReindexStatus() {
    const response = await fetch(`${this.baseUrl}/v1/rag/reindex/status`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error("Lỗi khi kiểm tra trạng thái tái lập chỉ mục.");
    }

    return await response.json();
  }

  async getEmbeddingModels() {
    const response = await fetch(`${this.baseUrl}/v1/rag/models`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error("Lỗi khi lấy thông số mô hình Embedding.");
    }

    return await response.json();
  }

  // ==================== DYNAMIC PC BUILDER QUESTIONS ====================

  async getBuilderQuestions(purpose = "gaming", step = 1, budget = 20000000, previous_answers = null) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/rag/pc-builder/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          step,
          budget: Number(budget) || 20000000,
          previous_answers: previous_answers || {}
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (!response.ok) {
        // Fallback sang GET nếu POST không được hỗ trợ
        const getRes = await fetch(`${this.baseUrl}/v1/rag/pc-builder/questions?purpose=${encodeURIComponent(purpose)}&step=${step}&budget=${budget}`, {
          method: "GET",
          signal: AbortSignal.timeout(15000)
        });
        if (!getRes.ok) {
          return this.getLocalFallbackQuestions(purpose, step, budget);
        }
        return await getRes.json();
      }

      return await response.json();
    } catch (err: any) {
      console.warn("Lỗi khi kết nối AI Service để lấy câu hỏi tương tác (sử dụng fallback nội bộ):", err?.message);
      return this.getLocalFallbackQuestions(purpose, step, budget);
    }
  }

  getLocalFallbackQuestions(purpose: string, step: number, budget: number) {
    const pLower = (purpose || "").toLowerCase();
    const isGaming = /game|gaming|gta|lol|esports|aaa|fifa|pubg|valorant|cs2|csgo|wukong/.test(pLower);
    const isOffice = /văn phòng|kế toán|office|word|excel|power bi|powerbi|tableau|sql|dữ liệu/.test(pLower);
    const isEditing = /đồ họa|video|photoshop|premiere|edit|render|3d|blender|autocad|thiết kế|capcut|after effects|canva/.test(pLower);
    const isAi = /ai|deep learning|docker|lập trình|code|python|machine learning/.test(pLower);
    const formattedBudget = Number(budget || 20000000).toLocaleString("vi-VN") + "đ";

    // ── DOMAIN 1: VĂN PHÒNG, KẾ TOÁN & PHÂN TÍCH DỮ LIỆU (POWER BI / EXCEL) ──
    if (isOffice) {
      if (step === 1) {
        return {
          is_valid: true,
          purpose,
          title: `Tối ưu máy tính làm việc (${purpose})`,
          description: `Đảm bảo máy chạy nhanh, mượt và bền bỉ trong ngân sách ${formattedBudget}`,
          step: 1,
          total_steps: 2,
          questions: [
            {
              id: "work_intensity",
              label: "Cường độ làm việc và xử lý dữ liệu của bạn?",
              type: "single_select",
              required: true,
              options: [
                { value: "data_analysis", label: "Xử lý dữ liệu lớn, Power BI, Excel nặng nhiều macro, Power Query" },
                { value: "basic_office", label: "Soạn thảo Word, duyệt web, email, hóa đơn kế toán cơ bản" },
                { value: "multitask", label: "Mở liên tục 40-60 tab trình duyệt, Zalo, CRM bán hàng đồng thời" }
              ]
            },
            {
              id: "monitor_count",
              label: "Bạn có nhu cầu xuất ra bao nhiêu màn hình làm việc?",
              type: "single_select",
              required: true,
              options: [
                { value: "single_monitor", label: "1 Màn hình làm việc tiêu chuẩn" },
                { value: "dual_monitor", label: "2 Màn hình song song để xem báo cáo và đối chiếu số liệu" },
                { value: "triple_plus", label: "3 Màn hình trở lên hoặc màn hình độ phân giải siêu rộng 2K/4K" }
              ]
            }
          ]
        };
      }
      return {
        is_valid: true,
        purpose,
        title: `Thói quen sử dụng & Không gian làm việc (${purpose})`,
        description: "Lựa chọn thói quen đa nhiệm, lưu trữ và kiểu dáng máy tính",
        step: 2,
        total_steps: 2,
        questions: [
          {
            id: "ram_preference",
            label: "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ram_16gb", label: "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web" },
              { value: "ram_32gb", label: "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời Zalo, nghe nhạc và làm việc mượt mà (Khuyên dùng)" },
              { value: "ram_64gb", label: "Rất nhiều: Xử lý file Excel cực nặng, Power BI và máy ảo đồng thời" }
            ]
          },
          {
            id: "storage_capacity",
            label: "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ssd_500gb", label: "Lưu trữ cơ bản: Đủ dùng cho hệ điều hành, tài liệu văn phòng và phần mềm thường dùng" },
              { value: "ssd_1tb", label: "Lưu trữ thoải mái: Tha hồ lưu ảnh, tài liệu nặng và dữ liệu nhiều năm (Khuyên dùng)" },
              { value: "ssd_2tb", label: "Lưu trữ khổng lồ: Kho dữ liệu lớn, an tâm làm việc lâu dài" }
            ]
          },
          {
            id: "network_connection",
            label: "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
            type: "single_select",
            options: [
              { value: "wifi_bt", label: "Bắt sóng Wi-Fi không dây: Gọn gàng, tiện lợi và có sẵn Bluetooth" },
              { value: "lan_cable", label: "Cắm dây mạng trực tiếp: Ổn định tối đa, tốc độ cao" },
              { value: "both", label: "Linh hoạt cả hai hình thức" }
            ]
          },
          {
            id: "case_style",
            label: "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
            type: "single_select",
            options: [
              { value: "stealth_black", label: "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái" },
              { value: "pure_white", label: "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc làm việc" },
              { value: "aquarium_rgb", label: "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng tạo cảm hứng" }
            ]
          }
        ]
      };
    }

    // ── DOMAIN 2: CHƠI GAME (GAMING) ──
    if (isGaming) {
      if (step === 1) {
        return {
          is_valid: true,
          purpose,
          title: `Tối ưu trải nghiệm chơi game (${purpose})`,
          description: `Khảo sát sức mạnh đồ họa và FPS cho ngân sách ${formattedBudget}`,
          step: 1,
          total_steps: 2,
          questions: [
            {
              id: "game_genre",
              label: "Thể loại game bạn dự định chơi nhiều nhất là gì?",
              type: "single_select",
              required: true,
              options: [
                { value: "esports", label: "Game đối kháng Esports mượt mà (LMHT, Valorant, CS2, FO4, Dota 2)" },
                { value: "aaa_openworld", label: "Game thế giới mở đồ họa bom tấn 3D (GTA V, Black Myth Wukong, Cyberpunk, Genshin)" },
                { value: "multi_game", label: "Chơi đa dạng mọi thể loại, kết hợp giải trí đa phương tiện" }
              ]
            },
            {
              id: "monitor_resolution",
              label: "Màn hình bạn đang dùng hoặc dự định kết nối có độ phân giải nào?",
              type: "single_select",
              required: true,
              options: [
                { value: "1080p_standard", label: "Màn hình Full HD (1080p) - Phổ biến, nhẹ nhàng và tiết kiệm chi phí" },
                { value: "2k_sharp", label: "Màn hình 2K (1440p) - Hình ảnh sắc nét, chi tiết cao" },
                { value: "4k_max", label: "Màn hình 4K hoặc Tivi lớn - Trải nghiệm hình ảnh chân thực đỉnh cao" }
              ]
            }
          ]
        };
      }
      return {
        is_valid: true,
        purpose,
        title: `Thói quen chơi game & Không gian giải trí (${purpose})`,
        description: "Lựa chọn thói quen đa nhiệm, lưu trữ và kiểu dáng thùng máy",
        step: 2,
        total_steps: 2,
        questions: [
          {
            id: "ram_gaming",
            label: "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ram_16gb", label: "Vừa phải: Chỉ tập trung chơi game và mở 1 vài ứng dụng nhẹ" },
              { value: "ram_32gb", label: "Nhiều & Thoải mái: Vừa chơi game nặng vừa mở Discord, nghe nhạc, hàng chục tab web (Khuyên dùng)" }
            ]
          },
          {
            id: "storage_capacity",
            label: "Nhu cầu lưu trữ game và dữ liệu giải trí của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ssd_500gb", label: "Lưu trữ cơ bản: Đủ cài 3-5 tựa game phổ biến" },
              { value: "ssd_1tb", label: "Lưu trữ thoải mái: Cài 10-15 game nặng mà không lo đầy bộ nhớ (Khuyên dùng)" },
              { value: "ssd_2tb", label: "Lưu trữ khổng lồ: Thư viện game bom tấn mênh mông" }
            ]
          },
          {
            id: "network_connection",
            label: "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
            type: "single_select",
            options: [
              { value: "lan_cable", label: "Cắm dây mạng trực tiếp: Độ trễ thấp, ping thấp tối đa khi chơi game" },
              { value: "wifi_bt", label: "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có Bluetooth" },
              { value: "both", label: "Cả hai hình thức để linh hoạt sử dụng" }
            ]
          },
          {
            id: "case_style",
            label: "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
            type: "single_select",
            options: [
              { value: "aquarium_rgb", label: "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng lung linh tạo cảm hứng" },
              { value: "stealth_black", label: "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái" },
              { value: "pure_white", label: "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc giải trí" }
            ]
          }
        ]
      };
    }

    // ── DOMAIN 3: ĐỒ HỌA, DỰNG VIDEO & THIẾT KẾ 3D (EDITING / PHOTOSHOP / RENDER) ──
    if (isEditing) {
      if (step === 1) {
        return {
          is_valid: true,
          purpose,
          title: `Tác vụ đồ họa & Phần mềm sáng tạo (${purpose})`,
          description: `Tối ưu hóa cấu hình cho tác vụ đồ họa trong tầm ngân sách ${formattedBudget}`,
          step: 1,
          total_steps: 2,
          questions: [
            {
              id: "software_focus",
              label: "Nhóm phần mềm đồ họa bạn làm việc thường xuyên nhất là gì?",
              type: "single_select",
              required: true,
              options: [
                { value: "design_2d", label: "Thiết kế ảnh 2D, banner, chỉnh màu (Photoshop, Illustrator, Lightroom, Canva)" },
                { value: "video_editing", label: "Dựng và cắt ghép video ngắn / dài (Premiere Pro, CapCut PC, DaVinci Resolve)" },
                { value: "motion_3d", label: "Kỹ xảo chuyển động & Dựng hình 3D (After Effects, Blender, 3Ds Max, AutoCAD)" }
              ]
            },
            {
              id: "render_resolution",
              label: "Độ phân giải sản phẩm bạn thường xuyên biên tập và xuất file:",
              type: "single_select",
              required: true,
              options: [
                { value: "fhd_1080p", label: "Full HD (1080p): Chuẩn video mạng xã hội TikTok, Reels, YouTube phổ thông" },
                { value: "2k_4k_pro", label: "2K hoặc 4K chuyên nghiệp: Yêu cầu chi tiết sắc nét và xử lý đồ họa mượt" }
              ]
            }
          ]
        };
      }
      return {
        is_valid: true,
        purpose,
        title: `Thói quen làm việc & Thẩm mỹ đồ họa (${purpose})`,
        description: "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách góc làm việc",
        step: 2,
        total_steps: 2,
        questions: [
          {
            id: "ram_creative",
            label: "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ram_32gb", label: "Nhiều & Thoải mái: Mở đồng thời Photoshop, Premiere, hàng chục tab web và nghe nhạc (Khuyên dùng)" },
              { value: "ram_64gb", label: "Rất nhiều: Dựng After Effects kỹ xảo nặng, Render 4K và nhiều ứng dụng đồ họa cực mượt" }
            ]
          },
          {
            id: "storage_capacity",
            label: "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ssd_1tb", label: "Lưu trữ thoải mái: Chứa thoải mái các file thiết kế, video dự án (Khuyên dùng)" },
              { value: "ssd_2tb", label: "Lưu trữ khổng lồ: Kho thư viện hình ảnh và video chất lượng cao nhiều năm" }
            ]
          },
          {
            id: "network_connection",
            label: "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
            type: "single_select",
            options: [
              { value: "lan_cable", label: "Cắm dây mạng trực tiếp: Ổn định và tải file tài liệu dung lượng lớn nhanh chóng" },
              { value: "wifi_bt", label: "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có sẵn Bluetooth" },
              { value: "both", label: "Linh hoạt cả hai hình thức" }
            ]
          },
          {
            id: "case_style",
            label: "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
            type: "single_select",
            options: [
              { value: "pure_white", label: "Tone màu Trắng trang nhã: Tinh tế, hiện đại, làm sáng không gian sáng tạo" },
              { value: "stealth_black", label: "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái" },
              { value: "aquarium_rgb", label: "Mặt kính trong suốt có đèn LED: Sang trọng, ánh sáng tạo cảm hứng" }
            ]
          }
        ]
      };
    }

    // ── DOMAIN 4: LẬP TRÌNH, TRÍ TUỆ NHÂN TẠO & MÁY ẢO (AI / CODE / DOCKER) ──
    if (isAi) {
      if (step === 1) {
        return {
          is_valid: true,
          purpose,
          title: `Môi trường phát triển & Công nghệ (${purpose})`,
          description: `Khảo sát ngăn xếp công nghệ trong tầm ngân sách ${formattedBudget}`,
          step: 1,
          total_steps: 2,
          questions: [
            {
              id: "tech_stack",
              label: "Lĩnh vực công nghệ hoặc tác vụ lập trình trọng tâm của bạn là gì?",
              type: "single_select",
              required: true,
              options: [
                { value: "web_backend", label: "Lập trình Web/Mobile/Backend, biên dịch mã nguồn, chạy cơ sở dữ liệu" },
                { value: "ai_deeplearning", label: "Trí tuệ nhân tạo (AI), Deep Learning, huấn luyện và fine-tune mô hình" },
                { value: "devops_vms", label: "DevOps, chạy nhiều container Docker đồng thời, máy ảo Kubernetes/WSL2" }
              ]
            },
            {
              id: "dev_intensity",
              label: "Mức độ chạy đồng thời nhiều tác vụ nặng trên máy:",
              type: "single_select",
              required: true,
              options: [
                { value: "moderate_load", label: "Chạy 3-5 container Docker và 1-2 IDE lập trình đồng thời" },
                { value: "heavy_load", label: "Chạy nhiều cụm microservices, huấn luyện mô hình liên tục nhiều giờ" }
              ]
            }
          ]
        };
      }
      return {
        is_valid: true,
        purpose,
        title: `Thói quen sử dụng & Không gian lập trình (${purpose})`,
        description: "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách bàn làm việc",
        step: 2,
        total_steps: 2,
        questions: [
          {
            id: "ram_capacity_ai",
            label: "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ram_32gb", label: "Nhiều & Thoải mái: Chạy Docker, VS Code, hàng chục tab web mượt mà (Khuyên dùng)" },
              { value: "ram_64gb", label: "Rất nhiều: Chạy đồng thời nhiều máy ảo nặng, xử lý dữ liệu lớn không lo giật lag" }
            ]
          },
          {
            id: "storage_capacity",
            label: "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
            type: "single_select",
            required: true,
            options: [
              { value: "ssd_1tb", label: "Lưu trữ thoải mái: Chứa thoải mái mã nguồn, container và dữ liệu (Khuyên dùng)" },
              { value: "ssd_2tb", label: "Lưu trữ khổng lồ: Kho dữ liệu huấn luyện lớn, an tâm lâu dài" }
            ]
          },
          {
            id: "network_connection",
            label: "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
            type: "single_select",
            options: [
              { value: "lan_cable", label: "Cắm dây mạng trực tiếp: Ổn định và tải dữ liệu nhanh chóng" },
              { value: "wifi_bt", label: "Bắt sóng Wi-Fi không dây: Tiện lợi và có sẵn Bluetooth" },
              { value: "both", label: "Cả hai hình thức để linh hoạt sử dụng" }
            ]
          },
          {
            id: "case_style",
            label: "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
            type: "single_select",
            options: [
              { value: "stealth_black", label: "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái, tập trung code" },
              { value: "pure_white", label: "Tone màu Trắng trang nhã: Sang trọng, làm sáng góc làm việc" },
              { value: "aquarium_rgb", label: "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng tạo cảm hứng" }
            ]
          }
        ]
      };
    }

    // ── DOMAIN 5: ĐA DỤNG PHỔ THÔNG (GENERAL) ──
    if (step === 1) {
      return {
        is_valid: true,
        purpose,
        title: `Tối ưu cấu hình cho: ${purpose}`,
        description: `Xác định tác vụ trọng tâm trong tầm ngân sách ${formattedBudget}`,
        step: 1,
        total_steps: 2,
        questions: [
          {
            id: "main_activity",
            label: "Bạn dành nhiều thời gian nhất cho tác vụ nào trên máy tính?",
            type: "single_select",
            required: true,
            options: [
              { value: "office_study", label: "Học tập, văn phòng, tra cứu tài liệu và xem phim giải trí" },
              { value: "creative_gaming", label: "Vừa làm việc vừa chơi game hoặc sáng tạo nội dung đa phương tiện" },
              { value: "long_term_speed", label: "Cần máy siêu bền bỉ, khởi động nhanh, dùng ổn định 5-7 năm" }
            ]
          },
          {
            id: "monitor_resolution",
            label: "Màn hình bạn đang dùng hoặc dự định kết nối:",
            type: "single_select",
            options: [
              { value: "fhd", label: "Full HD (1080p) - Chuẩn phổ thông" },
              { value: "2k_4k", label: "Màn hình 2K hoặc 4K sắc nét cao" }
            ]
          }
        ]
      };
    }

    // General Step 2
    return {
      is_valid: true,
      purpose,
      title: `Thói quen sử dụng & Không gian bàn làm việc (${purpose})`,
      description: "Lựa chọn thói quen đa nhiệm, lưu trữ và phong cách thùng máy",
      step: 2,
      total_steps: 2,
      questions: [
        {
          id: "general_ram",
          label: "Mức độ mở nhiều ứng dụng hoặc cửa sổ cùng lúc của bạn?",
          type: "single_select",
          required: true,
          options: [
            { value: "ram_16gb", label: "Vừa phải: Mở vài ứng dụng cơ bản và 10-15 tab web" },
            { value: "ram_32gb", label: "Nhiều & Thoải mái: Mở hàng chục tab web, chạy đồng thời ứng dụng làm việc mượt mà (Khuyên dùng)" }
          ]
        },
        {
          id: "general_storage",
          label: "Nhu cầu lưu trữ tài liệu, hình ảnh và phần mềm của bạn?",
          type: "single_select",
          required: true,
          options: [
            { value: "ssd_500gb", label: "Lưu trữ cơ bản: Đủ dùng cho hệ điều hành, tài liệu và ứng dụng thường dùng" },
            { value: "ssd_1tb", label: "Lưu trữ thoải mái: Thoải mái lưu ảnh, video kỷ niệm và dữ liệu lớn (Khuyên dùng)" }
          ]
        },
        {
          id: "network_connection",
          label: "Vị trí đặt máy tính của bạn kết nối Internet bằng hình thức nào?",
          type: "single_select",
          options: [
            { value: "wifi_bt", label: "Bắt sóng Wi-Fi không dây: Tiện lợi, không cần kéo dây mạng và có sẵn Bluetooth" },
            { value: "lan_cable", label: "Cắm dây mạng trực tiếp: Ổn định và tốc độ cao" },
            { value: "both", label: "Linh hoạt cả hai hình thức" }
          ]
        },
        {
          id: "general_case",
          label: "Bạn thích phong cách thùng máy đặt trên bàn làm việc như thế nào?",
          type: "single_select",
          options: [
            { value: "stealth_black", label: "Đen tối giản, kín đáo: Không đèn màu rườm rà, vận hành êm ái" },
            { value: "pure_white", label: "Tone màu Trắng trang nhã: Sang trọng, tinh tế" },
            { value: "aquarium_rgb", label: "Mặt kính trong suốt có đèn LED: Hiện đại, ánh sáng lung linh" }
          ]
        }
      ]
    };
  }
}

export const ragClientService = new RagClientService();
export default ragClientService;
