import type { Request, Response } from "express";
import { ragClientService } from "./rag-client.service";

class AiDocumentController {
  listDocuments = async (_req: Request, res: Response) => {
    try {
      const data = await ragClientService.listDocuments();
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Không thể lấy danh sách tài liệu RAG."
      });
    }
  };

  uploadDocument = async (req: Request, res: Response) => {
    try {
      const uploadedFile = (req as any).file;
      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn file tải lên (.pdf, .md, .txt)."
        });
      }

      const targetService = req.body.target_service || req.body.targetService || "all";
      const result = await ragClientService.uploadDocument(
        uploadedFile.buffer,
        uploadedFile.originalname,
        targetService
      );

      return res.json(result);
    } catch (err: any) {
      return res.status(422).json({
        success: false,
        message: err.message || "Lỗi khi tải lên và vector hóa tài liệu."
      });
    }
  };

  deleteDocument = async (req: Request, res: Response) => {
    try {
      const filename = String(req.params.filename || "");
      const result = await ragClientService.deleteDocument(filename);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi xóa tài liệu."
      });
    }
  };

  previewChunks = async (req: Request, res: Response) => {
    try {
      const filename = String(req.params.filename || "");
      const result = await ragClientService.previewChunks(filename);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi đọc phân đoạn chunks tài liệu."
      });
    }
  };

  reindex = async (_req: Request, res: Response) => {
    try {
      const result = await ragClientService.triggerReindex();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi tái lập chỉ mục Vector DB."
      });
    }
  };

  getReindexStatus = async (_req: Request, res: Response) => {
    try {
      const result = await ragClientService.getReindexStatus();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi kiểm tra tiến độ tái lập chỉ mục."
      });
    }
  };

  getEmbeddingModels = async (_req: Request, res: Response) => {
    try {
      const result = await ragClientService.getEmbeddingModels();
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Lỗi khi lấy thông tin mô hình Vector Embedding."
      });
    }
  };

  getBuilderQuestions = async (req: Request, res: Response) => {
    try {
      const purpose = String(req.body?.purpose || req.query.purpose || "gaming");
      const step = parseInt(String(req.body?.step || req.query.step || "1"), 10) || 1;
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
  };
}

export const aiDocumentController = new AiDocumentController();
export default aiDocumentController;
