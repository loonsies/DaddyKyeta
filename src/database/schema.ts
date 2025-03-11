import { pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  userId: text("user_id").primaryKey(),
  timezone: text("timezone"),
  birthday: timestamp("birthday"),
  bonkXp: integer("bonk_xp").notNull().default(0),
  boopXp: integer("boop_xp").notNull().default(0),
  biteXp: integer("bite_xp").notNull().default(0),
  pokeXp: integer("poke_xp").notNull().default(0),
  patXp: integer("pat_xp").notNull().default(0),
  bonksSent: integer("bonks_sent").notNull().default(0),
  boopsSent: integer("boops_sent").notNull().default(0),
  bitesSent: integer("bites_sent").notNull().default(0),
  pokesSent: integer("pokes_sent").notNull().default(0),
  patsSent: integer("pats_sent").notNull().default(0),
  bonksReceived: integer("bonks_received").notNull().default(0),
  boopsReceived: integer("boops_received").notNull().default(0),
  bitesReceived: integer("bites_received").notNull().default(0),
  pokesReceived: integer("pokes_received").notNull().default(0),
  patsReceived: integer("pats_received").notNull().default(0),
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

export const biteInteractions = pgTable("bite_interactions", {
  fromUserId: text("from_user_id").notNull().references(() => users.userId),
  toUserId: text("to_user_id").notNull().references(() => users.userId),
  count: integer("count").notNull().default(1),
  lastBiteAt: timestamp("last_bite_at").defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex("bite_unique_idx").on(table.fromUserId, table.toUserId)
}));

export const pokeInteractions = pgTable("poke_interactions", {
  fromUserId: text("from_user_id").notNull().references(() => users.userId),
  toUserId: text("to_user_id").notNull().references(() => users.userId),
  count: integer("count").notNull().default(1),
  lastPokeAt: timestamp("last_poke_at").defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex("poke_unique_idx").on(table.fromUserId, table.toUserId)
}));

export const patInteractions = pgTable("pat_interactions", {
  fromUserId: text("from_user_id").notNull().references(() => users.userId),
  toUserId: text("to_user_id").notNull().references(() => users.userId),
  count: integer("count").notNull().default(1),
  lastPatAt: timestamp("last_pat_at").defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex("pat_unique_idx").on(table.fromUserId, table.toUserId)
}));