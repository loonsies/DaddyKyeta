export const INTERACTION_TYPES = ["bonk", "boop", "bite", "pat", "poke", "smooch"] as const;

export type InteractionType = typeof INTERACTION_TYPES[number];

export const INTERACTION_TITLES = {
  bonk: "bonker",
  boop: "booper",
  bite: "biter",
  pat: "patter",
  poke: "poker",
  smooch: "smoocher"
} as const;

export const INTERACTION_EMOJIS = {
  bonk: "🔨💥🤕",
  boop: "👉✨🥺",
  bite: "😺🦷🤤",
  pat: "**( ´･･)ﾉ(˶ˆᗜˆ˵)**",
  poke: "**(˙༥˙(**👈",
  smooch: "**(=˘ ³( ,,>ᴗ<,,) ~♡**"
} as const; 