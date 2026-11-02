export interface LLMGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal | null;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  isBlocked?: boolean;
  isOfflineFallback?: boolean;
  isGrounded?: boolean;
  error?: string;
}

export interface LLMProviderInfo {
  provider: string;
  model: string;
  hasApiKey: boolean;
  isConfigured: boolean;
}

export declare class UnifiedLlmService {
  constructor(config?: any);
  configure(newConfig?: any): void;
  getProviderInfo(): LLMProviderInfo;
  generateText(options: LLMGenerateOptions): Promise<LLMResponse>;
}

export declare const unifiedLlmService: UnifiedLlmService;
