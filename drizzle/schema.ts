import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Núcleo da biblioteca: obras, exemplares, alunos e empréstimos.
 * Título/autor usam varchar (indexável); MySQL exige tamanho de chave para
 * colunas BLOB/TEXT usadas em índices, então text() não pode ser indexado.
 */
export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  isbn: varchar("isbn", { length: 13 }).notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  subtitle: varchar("subtitle", { length: 512 }),
  author: varchar("author", { length: 512 }).notNull(),
  publisher: varchar("publisher", { length: 255 }),
  edition: varchar("edition", { length: 64 }),
  year: varchar("year", { length: 4 }),
  pages: int("pages"),
  language: varchar("language", { length: 32 }),
  category: varchar("category", { length: 128 }),
  description: text("description"),
  coverUri: text("coverUri"),
  catalogSource: varchar("catalogSource", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("books_title_idx").on(table.title),
  index("books_author_idx").on(table.author),
]);
export type BookRecord = typeof books.$inferSelect;
export type InsertBookRecord = typeof books.$inferInsert;

export const bookCopies = mysqlTable("book_copies", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
  inventoryCode: varchar("inventoryCode", { length: 64 }).notNull(),
  barcode: varchar("barcode", { length: 64 }),
  shelf: varchar("shelf", { length: 128 }),
  status: mysqlEnum("status", ["available", "loaned", "maintenance", "lost"]).default("available").notNull(),
  condition: varchar("condition", { length: 64 }).default("bom"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("book_copies_book_idx").on(table.bookId),
  uniqueIndex("book_copies_inventory_unique").on(table.inventoryCode),
  uniqueIndex("book_copies_barcode_unique").on(table.barcode),
]);
export type BookCopyRecord = typeof bookCopies.$inferSelect;
export type InsertBookCopyRecord = typeof bookCopies.$inferInsert;

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  registrationCode: varchar("registrationCode", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  className: varchar("className", { length: 64 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("students_name_idx").on(table.name),
]);
export type StudentRecord = typeof students.$inferSelect;
export type InsertStudentRecord = typeof students.$inferInsert;

export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  copyId: int("copyId").notNull().references(() => bookCopies.id, { onDelete: "restrict" }),
  studentId: int("studentId").notNull().references(() => students.id, { onDelete: "restrict" }),
  borrowedAt: timestamp("borrowedAt").defaultNow().notNull(),
  dueAt: timestamp("dueAt").notNull(),
  returnedAt: timestamp("returnedAt"),
  status: mysqlEnum("status", ["active", "returned", "overdue"]).default("active").notNull(),
  notes: text("notes"),
}, (table) => [
  index("loans_copy_idx").on(table.copyId),
  index("loans_student_idx").on(table.studentId),
  index("loans_status_idx").on(table.status),
]);
export type LoanRecord = typeof loans.$inferSelect;
export type InsertLoanRecord = typeof loans.$inferInsert;
