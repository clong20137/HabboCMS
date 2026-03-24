"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNews = listNews;
exports.getNewsById = getNewsById;
exports.listRecentNewsExcluding = listRecentNewsExcluding;
exports.newsExists = newsExists;
async function listNews(pool, limit) {
    const [rows] = await pool.query(`
SELECT id, title, description, image_url, author, created_at
FROM news
ORDER BY created_at DESC
LIMIT ?
`, [limit]);
    return rows;
}
async function getNewsById(pool, id) {
    const [rows] = await pool.query(`
SELECT id, title, description, story_html AS story, image_url, author, created_at
FROM news
WHERE id = ?
LIMIT 1
`, [id]);
    return rows.length ? rows[0] : null;
}
async function listRecentNewsExcluding(pool, currentId, limit) {
    const [rows] = await pool.query(`
SELECT id, title, description, image_url, author, created_at
FROM news
WHERE id <> ?
ORDER BY created_at DESC
LIMIT ?
`, [currentId, limit]);
    return rows;
}
async function newsExists(pool, id) {
    const [rows] = await pool.query("SELECT id FROM news WHERE id = ? LIMIT 1", [id]);
    return rows.length > 0;
}
