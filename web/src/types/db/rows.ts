import type { RowDataPacket } from "mysql2/promise";

export type UserRow = RowDataPacket & {
  id: number;
  username: string;
  password: string | null;
  mail: string | null;
  auth_ticket: string | null;
  rank: number;

  credits?: number;
  bank_credits?: number;

  kills?: number;
  deaths?: number;
  robberies?: number;
  arrests?: number;
  punches_thrown?: number;
  punches_landed?: number;
  damage_inflicted?: number;
  damage_received?: number;

  strength?: number;
  knowledge?: number;
  gathering?: number;
  defense?: number;
  stamina?: number;
  stat_points?: number;
  stats_setup_done?: number;

  current_health?: number;
  max_health?: number;
  energy?: number;
  max_energy?: number;
  hunger?: number;
  max_hunger?: number;
  is_dead?: number;
  xp?: number;
  max_xp?: number;

  arena_wins?: number;
  arena_losses?: number;
  is_passive?: number;
  virtual_room_id?: number;

  motto?: string | null;
  look?: string | null;
};

export type LeaderboardRow = RowDataPacket & {
  id: number;
  username: string;
  value: number | string;
};

export type NewsRow = RowDataPacket & {
  id: number;
  title: string;
  description: string;
  story: string | null;
  image_url: string | null;
  author: string | null;
  created_at: string;
};

export type NewsCommentRow = RowDataPacket & {
  id: number;
  news_id: number;
  user_id: number;
  username: string;
  body: string;
  created_at: string;
};

export type ReactionCountRow = RowDataPacket & {
  reaction: string;
  cnt: number;
};

export type MyReactionRow = RowDataPacket & {
  reaction: string;
};
