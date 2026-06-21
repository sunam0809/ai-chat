import { z } from "zod/v4";

export const RegisterBody = z.object({
  username: z.string().min(2),
  password: z.string().min(4),
});

export const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const CreateConversationBody = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
});

export const UpdateConversationBody = z.object({
  title: z.string().optional(),
});

export const SendMessageBody = z.object({
  content: z.string().min(1),
  model: z.string().optional(),
});

export type RegisterBodyType = z.infer<typeof RegisterBody>;
export type LoginBodyType = z.infer<typeof LoginBody>;
export type CreateConversationBodyType = z.infer<typeof CreateConversationBody>;
export type UpdateConversationBodyType = z.infer<typeof UpdateConversationBody>;
export type SendMessageBodyType = z.infer<typeof SendMessageBody>;
