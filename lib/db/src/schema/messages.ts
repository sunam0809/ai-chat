import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

