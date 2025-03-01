import { pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  userId: text("user_id").primaryKey(),
  timezone: text("timezone"),
  birthday: timestamp("birthday"),
  bonkXp: integer("bonk_xp").notNull().default(0),
  boopXp: integer("boop_xp").notNull().default(0),
  bonksSent: integer("bonks_sent").notNull().default(0),
  boopsSent: integer("boops_sent").notNull().default(0),
  bonksReceived: integer("bonks_received").notNull().default(0),
  boopsReceived: integer("boops_received").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bonkInteractions = pgTable("bonk_interactions", {
  fromUserId: text("from_user_id").notNull().references(() => users.userId),
  toUserId: text("to_user_id").notNull().references(() => users.userId),
  count: integer("count").notNull().default(1),
  lastBonkAt: timestamp("last_bonk_at").defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex("bonk_unique_idx").on(table.fromUserId, table.toUserId)
}));

export const boopInteractions = pgTable("boop_interactions", {
  fromUserId: text("from_user_id").notNull().references(() => users.userId),
  toUserId: text("to_user_id").notNull().references(() => users.userId),
  count: integer("count").notNull().default(1),
  lastBoopAt: timestamp("last_boop_at").defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex("boop_unique_idx").on(table.fromUserId, table.toUserId)
}));