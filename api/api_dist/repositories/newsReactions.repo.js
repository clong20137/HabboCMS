"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReactionCountsByCommentIds = getReactionCountsByCommentIds;
exports.getMyReactionsForCommentIds = getMyReactionsForCommentIds;
exports.findExistingReaction = findExistingReaction;
exports.deleteReaction = deleteReaction;
exports.insertReaction = insertReaction;
exports.getReactionCountsForComment = getReactionCountsForComment;
exports.getMyReactionsForComment = getMyReactionsForComment;
async function getReactionCountsByCommentIds(pool, commentIds) {
    const [rows] = await pool.query(`
SELECT comment_id, reaction, COUNT(*) AS cnt
FROM news_comment_reactions
WHERE comment_id IN (?)
GROUP BY comment_id, reaction
`, [commentIds]);
    return rows;
}
async function getMyReactionsForCommentIds(pool, params) {
    const [rows] = await pool.query(`
SELECT comment_id, reaction
FROM news_comment_reactions
WHERE user_id = ? AND comment_id IN (?)
`, [params.userId, params.commentIds]);
    return rows;
}
async function findExistingReaction(pool, params) {
    const [rows] = await pool.query(`
SELECT id FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ? AND reaction = ?
LIMIT 1
`, [params.commentId, params.userId, params.reaction]);
    return rows.length > 0;
}
async function deleteReaction(pool, params) {
    await pool.query(`
DELETE FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ? AND reaction = ?
LIMIT 1
`, [params.commentId, params.userId, params.reaction]);
}
async function insertReaction(pool, params) {
    await pool.query(`
INSERT INTO news_comment_reactions (comment_id, user_id, reaction, created_at)
VALUES (?, ?, ?, NOW())
`, [params.commentId, params.userId, params.reaction]);
}
async function getReactionCountsForComment(pool, commentId) {
    const [rows] = await pool.query(`
SELECT reaction, COUNT(*) AS cnt
FROM news_comment_reactions
WHERE comment_id = ?
GROUP BY reaction
`, [commentId]);
    return rows;
}
async function getMyReactionsForComment(pool, params) {
    const [rows] = await pool.query(`
SELECT reaction
FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ?
`, [params.commentId, params.userId]);
    return rows;
}
