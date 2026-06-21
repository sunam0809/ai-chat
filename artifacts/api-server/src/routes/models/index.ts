import { Router } from "express";

const router = Router();

const MODELS = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    description: "가장 강력 — 복잡한 코딩, 추론, 분석 (권장)",
    contextWindow: 128000,
  },
  {
    id: "llama-3.1-70b-versatile",
    name: "Llama 3.1 70B",
    description: "강력한 범용 모델 — 코딩, 분석",
    contextWindow: 131072,
  },
  {
    id: "deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 70B",
    description: "추론 특화 — 수학, 논리, 복잡한 알고리즘",
    contextWindow: 131072,
  },
  {
    id: "qwen-qwq-32b",
    name: "Qwen QwQ 32B",
    description: "추론 특화 — 단계별 사고, 수학, 코딩",
    contextWindow: 131072,
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B (빠름)",
    description: "가장 빠름 — 간단한 질문, 빠른 응답",
    contextWindow: 131072,
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B",
    description: "Google 경량 모델 — 빠르고 효율적",
    contextWindow: 8192,
  },
];

router.get("/models", (_req, res) => {
  res.json(MODELS);
});

export default router;
