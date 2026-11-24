import { ragClientService  } from "./rag-client.service";

class AiDocumentController {
  async listDocuments(req, res) {
    try {
      const data = await ragClientService.listDocuments();
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Không thể lấy danh sách tài liệu RAG."
      });
    }
  }

  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn file tải lên (.pdf, .md, .txt)."
        });
      }

      const targetService = req.body.target_service || req.body.targetService || "all";
      const result = await ragClientService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        targetService
      );

      return res.json(result);
    } catch (err: any) {
      return res.status(422).json({
        success: false,
        message: err.message || "Lỗi khi tải lên và vector hóa tài liệu."
      });
    }
  }

  async deleteDocument(req, res) {
    try {
      const { filename } = req.params;
      const result = await ragClientService.deleteDocument(filename);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi xóa tài liệu."
      });
    }
  }

  async previewChunks(req, res) {
    try {
      const { filename } = req.params;
      const result = await ragClientService.previewChunks(filename);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi đọc phân đoạn chunks tài liệu."
      });
    }
  }

  async reindex(req, res) {
    try {
      const result = await ragClientService.triggerReindex();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi tái lập chỉ mục Vector DB."
      });
    }
  }

  async getReindexStatus(req, res) {
    try {
      const result = await ragClientService.getReindexStatus();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi kiểm tra tiến độ tái lập chỉ mục."
      });
    }
  }

  async getEmbeddingModels(req, res) {
    try {
      const result = await ragClientService.getEmbeddingModels();
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi lấy thông tin mô hình Vector Embedding."
      });
    }
  }

  async getBuilderQuestions(req, res) {
    try {
      const purpose = req.body?.purpose || req.query.purpose || "gaming";
      const step = parseInt(req.body?.step || req.query.step, 10) || 1;
      const budget = Number(req.body?.budget || req.query.budget || 20000000);
      const previousAnswers = req.body?.previous_answers || req.body?.previousAnswers || null;

      const result = await ragClientService.getBuilderQuestions(purpose, step, budget, previousAnswers);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi lấy câu hỏi tương tác build PC."
      });
    }
  }
}

export const aiDocumentController = new AiDocumentController();
export default aiDocumentController;
