import type { RowDataPacket } from "mysql2/promise";

export type UserRow = RowDataPacket & {
  id: number;
  username: string;
  password: string | null;
  mail: string | null;
  auth_ticket: string | null;
  rank: number;

  credits?: number;
  bank_amount?: number;
  kd?: number;

  kills?: number;
  deaths?: number;
  punches_thrown?: number;
  punches_received?: number;
  arrests_made?: number;
  arrests_amount?: number;
  damage_dealt?: number;
  damage_received?: number;

  health?: number;
  max_health?: number;
  energy?: number;
  max_energy?: number;

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
