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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_REGEX = exports.USERNAME_REGEX = void 0;
exports.getRegisterConfig = getRegisterConfig;
exports.checkUsernameAvailability = checkUsernameAvailability;
exports.register = register;
exports.login = login;
exports.getMe = getMe;
exports.createSsoTicket = createSsoTicket;
exports.markNewUserNeedsStatsSetup = markNewUserNeedsStatsSetup;
exports.getStatsSetupStatus = getStatsSetupStatus;
exports.applyStatsSetup = applyStatsSetup;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const cmsSettings_1 = require("../utils/cmsSettings");
const password_1 = require("../utils/password");
const betaKeysRepo = __importStar(require("../repositories/betaKeys.repo"));
const usersRepo = __importStar(require("../repositories/users.repo"));
const corporations_repo_1 = require("../repositories/corporations.repo");
exports.USERNAME_REGEX = /^[a-zA-Z0-9-]+$/;
exports.PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
function isMd5Hash(s) {
    return typeof s === "string" && /^[a-f0-9]{32}$/i.test(s);
}
function isSha1Hash(s) {
    return typeof s === "string" && /^[a-f0-9]{40}$/i.test(s);
}
function md5(s) {
    return crypto_1.default.createHash("md5").update(s).digest("hex");
}
function sha1(s) {
    return crypto_1.default.createHash("sha1").update(s).digest("hex");
}
async function getRegisterConfig(pool) {
    const betaMode = await (0, cmsSettings_1.getCmsSetting)(pool, "beta_mode_enabled", "0");
    return { betaRequired: betaMode === "1" };
}
async function checkUsernameAvailability(pool, username) {
    const u = username.trim();
    if (u.length < 3 || u.length > 24 || !exports.USERNAME_REGEX.test(u)) {
        return { available: false };
    }
    const exists = await usersRepo.usernameExists(pool, u);
    return { available: !exists };
}
async function register(pool, params) {
    const username = params.username.trim();
    const email = params.email.trim();
    const password = String(params.password || "");
    const confirmPassword = String(params.confirmPassword || "");
    const betaCode = String(params.betaCode || "").trim();
    if (username.length < 3) {
        const err = new Error("Username must be at least 3 characters.");
        err.status = 400;
        throw err;
    }
    if (username.length > 24) {
        const err = new Error("Username cannot exceed 24 characters.");
        err.status = 400;
        throw err;
    }
    if (!exports.USERNAME_REGEX.test(username)) {
        const err = new Error("Username can only contain letters, numbers, and dashes (-).");
        err.status = 400;
        throw err;
    }
    if (!email.includes("@")) {
        const err = new Error("Please enter a valid email.");
        err.status = 400;
        throw err;
    }
    if (!exports.PASSWORD_REGEX.test(password)) {
        const err = new Error("Password must be at least 8 characters and include an uppercase letter, a number, and a special character.");
        err.status = 400;
        throw err;
    }
    if (!confirmPassword) {
        const err = new Error("Please confirm your password.");
        err.status = 400;
        throw err;
    }
    if (password !== confirmPassword) {
        const err = new Error("Passwords do not match.");
        err.status = 400;
        throw err;
    }
    const betaMode = await (0, cmsSettings_1.getCmsSetting)(pool, "beta_mode_enabled", "0");
    let betaKeyId = null;
    if (betaMode === "1") {
        if (!betaCode) {
            const err = new Error("Registration is currently beta-only. Please enter a beta code.");
            err.status = 403;
            throw err;
        }
        betaKeyId = await betaKeysRepo.findUnusedBetaKeyIdByCode(pool, betaCode);
        if (!betaKeyId) {
            const err = new Error("Invalid or already-used beta code.");
            err.status = 403;
            throw err;
        }
    }
    const exists = await usersRepo.usernameExists(pool, username);
    if (exists) {
        const err = new Error("That username is already taken.");
        err.status = 400;
        throw err;
    }
    const hash = await bcrypt_1.default.hash(password, 12);
    const unix = Math.floor(Date.now() / 1000).toString();
    const userId = await usersRepo.insertUser(pool, {
        username,
        passwordHash: hash,
        email,
        accountCreatedUnix: unix,
        ip: String(params.ip || "127.0.0.1"),
    });
    if (betaMode === "1" && betaKeyId) {
        await betaKeysRepo.markBetaKeyUsed(pool, {
            betaKeyId,
            usedByUserId: userId,
        });
    }
    return { userId, username, rank: 1 };
}
async function login(pool, params) {
    const username = params.username.trim();
    const password = String(params.password || "");
    const user = await usersRepo.findUserForLogin(pool, username);
    if (!user?.password) {
        const err = new Error("Invalid username or password.");
        err.status = 401;
        throw err;
    }
    const stored = String(user.password);
    if ((0, password_1.isBcryptHash)(stored)) {
        const ok = await bcrypt_1.default.compare(password, stored);
        if (!ok) {
            const err = new Error("Invalid username or password.");
            err.status = 401;
            throw err;
        }
        return { id: Number(user.id), username: String(user.username), rank: Number(user.rank ?? 0) };
    }
    let legacyOk = false;
    if (isMd5Hash(stored))
        legacyOk = md5(password) === stored.toLowerCase();
    else if (isSha1Hash(stored))
        legacyOk = sha1(password) === stored.toLowerCase();
    else
        legacyOk = stored === password;
    if (!legacyOk) {
        const err = new Error("Invalid username or password.");
        err.status = 401;
        throw err;
    }
    try {
        const newHash = await bcrypt_1.default.hash(password, 12);
        await usersRepo.updatePasswordHash(pool, Number(user.id), newHash);
    }
    catch {
        // ignore upgrade errors
    }
    return { id: Number(user.id), username: String(user.username), rank: Number(user.rank ?? 0) };
}
async function getMe(pool, userId) {
    const user = await usersRepo.getMeById(pool, userId);
    if (!user)
        return null;
    const corporation = await (0, corporations_repo_1.getCorporationForUser)(pool, userId);
    return {
        ...user,
        corporation: corporation
            ? {
                id: Number(corporation.corporation_id),
                name: String(corporation.corporation_name),
                icon: corporation.corporation_icon ? String(corporation.corporation_icon) : null,
                canWorkAnywhere: Boolean(corporation.can_work_anywhere),
                rankId: corporation.rank_id != null ? Number(corporation.rank_id) : null,
                rankName: corporation.rank_name ? String(corporation.rank_name) : null,
                rankOrder: corporation.rank_order != null ? Number(corporation.rank_order) : null,
                isManager: Boolean(corporation.is_manager),
                weeklyShifts: Number(corporation.weekly_shifts ?? 0),
                totalShifts: Number(corporation.total_shifts ?? 0),
            }
            : null,
    };
}
async function createSsoTicket(pool, params) {
    await usersRepo.updateAuthTicket(pool, params.userId, params.ticket);
}
async function markNewUserNeedsStatsSetup(pool, userId) {
    await pool.query(`UPDATE user_stats SET stat_points = 5, stats_setup_done = 0 WHERE user_id = ?`, [userId]);
}
async function getStatsSetupStatus(pool, userId) {
    const [rows] = (await pool.query(`SELECT
      stats_setup_done,
      stat_points,
      strength,
      knowledge,
      gathering,
      defense,
      stamina,
      current_health,
      max_health,
      energy,
      max_energy
    FROM user_stats
    WHERE user_id = ? LIMIT 1`, [userId]));
    const u = rows?.[0];
    if (!u)
        return { ok: false };
    return {
        ok: true,
        statsSetupDone: Number(u.stats_setup_done) === 1,
        points: Number(u.stat_points || 0),
        strength: Number(u.strength || 0),
        knowledge: Number(u.knowledge || 0),
        farming: Number(u.gathering || 0),
        health: 0,
        defense: Number(u.defense || 0),
        stamina: Number(u.stamina || 0),
        maxHealth: Number(u.max_health || 100),
        maxEnergy: Number(u.max_energy || 100),
    };
}
async function applyStatsSetup(pool, userId, inc) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = (await conn.query(`SELECT stat_points, stats_setup_done FROM user_stats WHERE user_id = ? FOR UPDATE`, [userId]));
        const u = rows?.[0];
        if (!u)
            throw new Error("User stats not found.");
        if (Number(u.stats_setup_done) === 1) {
            await conn.commit();
            return { ok: true, alreadyDone: true };
        }
        const available = Number(u.stat_points || 0);
        const total = inc.strength + inc.knowledge + inc.farming + inc.health + inc.defense + inc.stamina;
        if (!Number.isFinite(total) || total <= 0)
            throw new Error("No points applied.");
        if (total > available)
            throw new Error("Not enough points.");
        const addMaxHealth = inc.health * 5;
        const addCurrentHealth = inc.health * 5;
        const addMaxEnergy = inc.stamina * 5;
        const addEnergy = inc.stamina * 5;
        await conn.query(`UPDATE user_stats
       SET
         strength = strength + ?,
         knowledge = knowledge + ?,
         gathering = gathering + ?,
         defense = defense + ?,
         stamina = stamina + ?,
         max_health = max_health + ?,
         current_health = current_health + ?,
         max_energy = max_energy + ?,
         energy = energy + ?,
         stat_points = stat_points - ?,
         stats_setup_done = CASE WHEN (stat_points - ?) <= 0 THEN 1 ELSE stats_setup_done END
       WHERE user_id = ?`, [
            inc.strength,
            inc.knowledge,
            inc.farming,
            inc.defense,
            inc.stamina,
            addMaxHealth,
            addCurrentHealth,
            addMaxEnergy,
            addEnergy,
            total,
            total,
            userId,
        ]);
        await conn.commit();
        return { ok: true, spent: total };
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
