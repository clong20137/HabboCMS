"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
async function withTransaction(dbPool, fn) {
    const conn = await dbPool.getConnection();
    try {
        await conn.beginTransaction();
        const out = await fn(conn);
        await conn.commit();
        return out;
    }
    catch (err) {
        try {
            await conn.rollback();
        }
        catch {
            // ignore rollback errors
        }
        throw err;
    }
    finally {
        conn.release();
    }
}
