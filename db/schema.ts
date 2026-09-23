import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("◆"),
  accent: text("accent").notNull().default("#f4b860"),
  sourceType: text("source_type").notNull().default("git"),
  repositoryUrl: text("repository_url").notNull(),
  branch: text("branch").notNull().default("main"),
  documentPaths: text("document_paths").notNull().default('["handoff.md"]'),
  encryptedToken: text("encrypted_token"),
  tokenIv: text("token_iv"),
  lastSyncedAt: text("last_synced_at"),
  lastRevision: text("last_revision"),
  lastAuthor: text("last_author"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_projects_slug").on(table.slug)]);

export const projectDocuments = sqliteTable("project_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  content: text("content").notNull().default(""),
  contentHash: text("content_hash").notNull().default(""),
  fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_project_documents_project_path").on(table.projectId, table.path),
  index("idx_project_documents_project_id").on(table.projectId),
]);

export const repositoryAccessEvents = sqliteTable("repository_access_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_repository_access_events_user_project_time").on(table.userId, table.projectId, table.createdAt),
]);

export const repositoryBridges = sqliteTable("repository_bridges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  publicUrl: text("public_url").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_repository_bridges_project_id").on(table.projectId),
]);
