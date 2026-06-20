import { z } from "zod";

export const RegisterBody = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
});

export const LoginBody = z.object({
  username: z.string(),
  password: z.string(),
});

export const CreateConversationBody = z.object({
  title: z.string().optional(),
  model: z.string().default("anthropic/claude-sonnet-4-5"),
});

export const UpdateConversationBody = z.object({
  title: z.string(),
});

export const SendMessageBody = z.object({
  content: z.string(),
  model: z.string().optional(),
});

