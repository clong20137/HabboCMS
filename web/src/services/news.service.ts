import type { Pool } from "mysql2/promise";

import { withTransaction } from "../db";
import { AppError, notFound } from "../errors/AppError";
import { toNewsImageUrl } from "../utils/news";
import * as newsRepo from "../repositories/news.repo";
import * as commentsRepo from "../repositories/newsComments.repo";
import * as reactionsRepo from "../repositories/newsReactions.repo";

export function assertAllowedReaction(reaction: string): void {
const value = String(reaction || "").trim();

if (!value) {
throw new AppError(400, "Invalid reaction.", { code: "BAD_REQUEST" });
}

if (value.length > 32) {
throw new AppError(400, "Reaction is too long.", {
code: "BAD_REQUEST",
});
}
}

export async function listNews(pool: Pool, limit: number) {
const rows = await newsRepo.listNews(pool, limit);

return rows.map((n) => ({
id: Number(n.id),
title: String(n.title),
description: String(n.description ?? ""),
author: String(n.author ?? "Staff"),
image: String(n.image_url ?? ""),
imageUrl: toNewsImageUrl(n.image_url),
createdAt: n.created_at ? String(n.created_at) : "",
}));
}

export async function getNews(pool: Pool, id: number) {
const n = await newsRepo.getNewsById(pool, id);
if (!n) return null;

return {
id: Number(n.id),
title: String(n.title),
description: String(n.description ?? ""),
story: n.story ? String(n.story) : "",
author: String(n.author ?? "Staff"),
image: String(n.image_url ?? ""),
imageUrl: toNewsImageUrl(n.image_url),
createdAt: n.created_at ? String(n.created_at) : "",
};
}

export async function listRecent(pool: Pool, currentId: number, limit: number) {
const rows = await newsRepo.listRecentNewsExcluding(pool, currentId, limit);

return rows.map((n) => ({
id: Number(n.id),
title: String(n.title),
description: String(n.description ?? ""),
author: String(n.author ?? "Staff"),
image: String(n.image_url ?? ""),
imageUrl: toNewsImageUrl(n.image_url),
createdAt: n.created_at ? String(n.created_at) : "",
}));
}

export async function listComments(
pool: Pool,
params: { newsId: number; limit: number; viewerUserId?: number },
) {
const rows = await commentsRepo.listCommentsForNews(pool, {
newsId: params.newsId,
limit: params.limit,
});

const commentIds = rows
.map((r) => Number((r as any).id))
.filter((x) => x > 0);

const reactionCountsByComment: Record<number, Record<string, number>> = {};

if (commentIds.length) {
const rc = await reactionsRepo.getReactionCountsByCommentIds(
pool,
commentIds,
);

for (const row of rc as any[]) {
const cid = Number(row.comment_id);
const reaction = String(row.reaction);
const cnt = Number(row.cnt ?? 0);

if (!reactionCountsByComment[cid]) {
reactionCountsByComment[cid] = {};
}

reactionCountsByComment[cid][reaction] = cnt;
}
}

const myByComment: Record<number, string[]> = {};

if (params.viewerUserId && commentIds.length) {
const mr = await reactionsRepo.getMyReactionsForCommentIds(pool, {
userId: params.viewerUserId,
commentIds,
});

for (const row of mr as any[]) {
const cid = Number(row.comment_id);
const reaction = String(row.reaction);

if (!myByComment[cid]) {
myByComment[cid] = [];
}

myByComment[cid].push(reaction);
}
}

return rows.map((c: any) => {
const id = Number(c.id);

return {
id,
newsId: Number(c.news_id),
userId: Number(c.user_id),
username: String(c.username ?? "Unknown"),
body: String(c.body ?? ""),
createdAt: c.created_at ? String(c.created_at) : "",
reactions: reactionCountsByComment[id] ?? {},
myReactions: myByComment[id] ?? [],
};
});
}

export async function addComment(
pool: Pool,
params: { newsId: number; userId: number; username: string; body: string },
) {
const exists = await newsRepo.newsExists(pool, params.newsId);
if (!exists) {
throw notFound("Story not found.");
}

const trimmedBody = String(params.body ?? "").trim();
if (trimmedBody.length < 2) {
throw new AppError(400, "Comment is too short.", { code: "BAD_REQUEST" });
}

const commentId = await commentsRepo.insertComment(pool, {
newsId: params.newsId,
userId: params.userId,
username: params.username,
body: trimmedBody,
});

return {
id: commentId,
newsId: params.newsId,
userId: params.userId,
username: params.username,
body: trimmedBody,
createdAt: new Date().toISOString(),
reactions: {},
myReactions: [],
};
}

export async function toggleReaction(
pool: Pool,
params: { commentId: number; userId: number; reaction: string },
): Promise<{ reactions: Record<string, number>; myReactions: string[] }> {
const reaction = String(params.reaction || "").trim();
assertAllowedReaction(reaction);

const exists = await commentsRepo.commentExists(pool, params.commentId);
if (!exists) {
throw notFound("Comment not found.");
}

await withTransaction(pool, async (conn) => {
const already = await reactionsRepo.findExistingReaction(conn, {
commentId: params.commentId,
userId: params.userId,
reaction,
});

if (already) {
await reactionsRepo.deleteReaction(conn, {
commentId: params.commentId,
userId: params.userId,
reaction,
});
} else {
await reactionsRepo.insertReaction(conn, {
commentId: params.commentId,
userId: params.userId,
reaction,
});
}
});

const counts = await reactionsRepo.getReactionCountsForComment(
pool,
params.commentId,
);

const reactions: Record<string, number> = {};

for (const r of counts as any[]) {
reactions[String(r.reaction)] = Number(r.cnt ?? 0);
}

const mine = await reactionsRepo.getMyReactionsForComment(pool, {
commentId: params.commentId,
userId: params.userId,
});

return {
reactions,
myReactions: (mine as any[]).map((x) => String(x.reaction)),
};
}
