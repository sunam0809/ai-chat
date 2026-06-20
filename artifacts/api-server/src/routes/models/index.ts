import { Router } from "express";

const router = Router();

const MODELS = [
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    description: "최신 Sonnet — 빠르고 강력, 코딩에 최적",
    contextWindow: 200000,
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    description: "가장 강력한 모델 — 복잡한 추론, 깊은 분석",
    contextWindow: 200000,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude Haiku 3.5",
    description: "가장 빠름 — 간단한 작업, 빠른 응답",
    contextWindow: 200000,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    description: "추론 특화 — 수학, 논리, 복잡한 코딩",
    contextWindow: 65536,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Google 최신 — 긴 컨텍스트, 멀티모달",
    contextWindow: 1000000,
  },
];

router.get("/models", (_req, res) => {
  res.json(MODELS);
});

export default router;
