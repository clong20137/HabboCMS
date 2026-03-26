"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertAllowedReaction = assertAllowedReaction;
exports.listNews = listNews;
exports.getNews = getNews;
exports.listRecent = listRecent;
exports.listComments = listComments;
exports.addComment = addComment;
exports.toggleReaction = toggleReaction;
const db_1 = require("../db");
const AppError_1 = require("../errors/AppError");
const news_1 = require("../utils/news");
const newsRepo = __importStar(require("../repositories/news.repo"));
const commentsRepo = __importStar(require("../repositories/newsComments.repo"));
const reactionsRepo = __importStar(require("../repositories/newsReactions.repo"));
function assertAllowedReaction(reaction) {
    const value = String(reaction || "").trim();
    if (!value) {
        throw new AppError_1.AppError(400, "Invalid reaction.", { code: "BAD_REQUEST" });
    }
    if (value.length > 32) {
        throw new AppError_1.AppError(400, "Reaction is too long.", {
            code: "BAD_REQUEST",
        });
    }
}
async function listNews(pool, limit) {
    const rows = await newsRepo.listNews(pool, limit);
    return rows.map((n) => ({
        id: Number(n.id),
        title: String(n.title),
        description: String(n.description ?? ""),
        author: String(n.author ?? "Staff"),
        image: String(n.image_url ?? ""),
        imageUrl: (0, news_1.toNewsImageUrl)(n.image_url),
        createdAt: n.created_at ? String(n.created_at) : "",
    }));
}
async function getNews(pool, id) {
    const n = await newsRepo.getNewsById(pool, id);
    if (!n)
        return null;
    return {
        id: Number(n.id),
        title: String(n.title),
        description: String(n.description ?? ""),
        story: n.story ? String(n.story) : "",
        author: String(n.author ?? "Staff"),
        image: String(n.image_url ?? ""),
        imageUrl: (0, news_1.toNewsImageUrl)(n.image_url),
        createdAt: n.created_at ? String(n.created_at) : "",
    };
}
async function listRecent(pool, currentId, limit) {
    const rows = await newsRepo.listRecentNewsExcluding(pool, currentId, limit);
    return rows.map((n) => ({
        id: Number(n.id),
        title: String(n.title),
        description: String(n.description ?? ""),
        author: String(n.author ?? "Staff"),
        image: String(n.image_url ?? ""),
        imageUrl: (0, news_1.toNewsImageUrl)(n.image_url),
        createdAt: n.created_at ? String(n.created_at) : "",
    }));
}
async function listComments(pool, params) {
    const rows = await commentsRepo.listCommentsForNews(pool, {
        newsId: params.newsId,
        limit: params.limit,
    });
    const commentIds = rows
        .map((r) => Number(r.id))
        .filter((x) => x > 0);
    const reactionCountsByComment = {};
    if (commentIds.length) {
        const rc = await reactionsRepo.getReactionCountsByCommentIds(pool, commentIds);
        for (const row of rc) {
            const cid = Number(row.comment_id);
            const reaction = String(row.reaction);
            const cnt = Number(row.cnt ?? 0);
            if (!reactionCountsByComment[cid]) {
                reactionCountsByComment[cid] = {};
            }
            reactionCountsByComment[cid][reaction] = cnt;
        }
    }
    const myByComment = {};
    if (params.viewerUserId && commentIds.length) {
        const mr = await reactionsRepo.getMyReactionsForCommentIds(pool, {
            userId: params.viewerUserId,
            commentIds,
        });
        for (const row of mr) {
            const cid = Number(row.comment_id);
            const reaction = String(row.reaction);
            if (!myByComment[cid]) {
                myByComment[cid] = [];
            }
            myByComment[cid].push(reaction);
        }
    }
    return rows.map((c) => {
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
async function addComment(pool, params) {
    const exists = await newsRepo.newsExists(pool, params.newsId);
    if (!exists) {
        throw (0, AppError_1.notFound)("Story not found.");
    }
    const trimmedBody = String(params.body ?? "").trim();
    if (trimmedBody.length < 2) {
        throw new AppError_1.AppError(400, "Comment is too short.", { code: "BAD_REQUEST" });
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
async function toggleReaction(pool, params) {
    const reaction = String(params.reaction || "").trim();
    assertAllowedReaction(reaction);
    const exists = await commentsRepo.commentExists(pool, params.commentId);
    if (!exists) {
        throw (0, AppError_1.notFound)("Comment not found.");
    }
    await (0, db_1.withTransaction)(pool, async (conn) => {
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
        }
        else {
            await reactionsRepo.insertReaction(conn, {
                commentId: params.commentId,
                userId: params.userId,
                reaction,
            });
        }
    });
    const counts = await reactionsRepo.getReactionCountsForComment(pool, params.commentId);
    const reactions = {};
    for (const r of counts) {
        reactions[String(r.reaction)] = Number(r.cnt ?? 0);
    }
    const mine = await reactionsRepo.getMyReactionsForComment(pool, {
        commentId: params.commentId,
        userId: params.userId,
    });
    return {
        reactions,
        myReactions: mine.map((x) => String(x.reaction)),
    };
}
