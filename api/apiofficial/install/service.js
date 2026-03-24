"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preflightInstall = preflightInstall;
exports.runInstall = runInstall;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const promise_1 = __importDefault(require("mysql2/promise"));
function appError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}
function normalizeUrl(value, label) {
    const url = String(value || '').trim();
    if (!/^https?:\/\//i.test(url))
        throw appError(`${label} must start with http:// or https://`);
    return url.replace(/\/$/, '');
}
function normalizeUsername(value) {
    const username = String(value || '').trim();
    if (!/^[a-zA-Z0-9-]{3,24}$/.test(username)) {
        throw appError('Admin username must be 3-24 characters and contain only letters, numbers, or dashes.');
    }
    return username;
}
function normalizeEmail(value) {
    const email = String(value || '').trim();
    if (!/^.+@.+\..+$/.test(email))
        throw appError('Enter a valid admin email address.');
    return email;
}
function normalizePassword(password, confirmPassword) {
    const pwd = String(password || '');
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(pwd)) {
        throw appError('Admin password must be at least 8 characters and include an uppercase letter, number, and special character.');
    }
    if (pwd !== String(confirmPassword || '')) {
        throw appError('Passwords do not match.');
    }
    return pwd;
}
function generateSecret(bytes = 32) {
    return crypto_1.default.randomBytes(bytes).toString('hex');
}
async function ensureBaseTables(conn) {
    const required = ['users', 'user_stats'];
    for (const table of required) {
        const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
        if (!rows.length) {
            throw appError(`Missing required hotel table: ${table}. Import your hotel database before running the CMS installer.`);
        }
    }
}
async function ensureCmsTables(conn) {
    await conn.query(`
    CREATE TABLE IF NOT EXISTS cms_settings (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS news (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      story_html LONGTEXT NOT NULL,
      image_url VARCHAR(500) NULL,
      author VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS news_comments (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      news_id INT NOT NULL,
      user_id INT NOT NULL,
      username VARCHAR(100) NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_news_comments_news_id (news_id),
      INDEX idx_news_comments_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS news_comment_reactions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      reaction VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_news_comment_reaction (comment_id, user_id, reaction),
      INDEX idx_news_comment_reaction_comment (comment_id),
      INDEX idx_news_comment_reaction_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(100) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_support_tickets_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      user_id INT NULL,
      message TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_support_ticket_messages_ticket_id (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS beta_keys (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      used_by INT NULL,
      used_at DATETIME NULL,
      UNIQUE KEY uq_beta_keys_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS server_status (
      id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
      users_online INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await conn.query(`
    CREATE TABLE IF NOT EXISTS wordfilter (
      word VARCHAR(100) NOT NULL PRIMARY KEY,
      replacement VARCHAR(255) NOT NULL DEFAULT '',
      strict TINYINT(1) NOT NULL DEFAULT 1,
      addedby VARCHAR(100) NOT NULL DEFAULT '',
      bannable TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
async function upsertSetting(conn, key, value) {
    await conn.query(`INSERT INTO cms_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [key, value]);
}
async function ensureAdminUser(conn, params) {
    const [rows] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [params.username]);
    let userId = rows.length ? Number(rows[0].id) : 0;
    if (userId > 0) {
        await conn.query('UPDATE users SET password = ?, mail = ?, `rank` = 7, ip_current = ? WHERE id = ? LIMIT 1', [params.passwordHash, params.email, params.ip, userId]);
    }
    else {
        const authTicket = `CMS-${crypto_1.default.randomBytes(32).toString('hex')}`;
        const unix = Math.floor(Date.now() / 1000).toString();
        const [inserted] = await conn.query(`INSERT INTO users (
        username, password, mail, account_created, ip_register, ip_current, auth_ticket,
        \`rank\`, credits
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 7, 50000)`, [params.username, params.passwordHash, params.email, unix, params.ip, params.ip, authTicket]);
        userId = Number(inserted.insertId);
    }
    const [statRows] = await conn.query('SELECT user_id FROM user_stats WHERE user_id = ? LIMIT 1', [userId]);
    if (!statRows.length) {
        await conn.query(`INSERT INTO user_stats (
        user_id, punches_thrown, punches_landed, damage_inflicted, damage_received,
        shifts_worked, kills, deaths, robberies, arrests, strength, energy, stamina,
        hunger, current_health, max_health, is_dead, xp, max_xp, max_energy,
        max_hunger, shifts_completed, aggression, level, stat_points, hunger_level,
        gathering, defense, virtual_room_id, is_passive, name_icon_id, bank_credits,
        last_room_id, last_x, last_y, last_z, arena_wins, arena_losses, knowledge,
        stats_setup_done
      ) VALUES (
        ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 60, 100,
        100, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
      )`, [userId]);
    }
    return userId;
}
async function backupAndWriteEnv(apiDir, values) {
    const envPath = path_1.default.join(apiDir, '.env');
    try {
        const existing = await promises_1.default.readFile(envPath, 'utf8');
        const backupPath = path_1.default.join(apiDir, `.env.backup-${Date.now()}`);
        await promises_1.default.writeFile(backupPath, existing);
    }
    catch { }
    const content = Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    await promises_1.default.writeFile(envPath, `${content}\n`);
}
async function assertWritable(apiDir) {
    await promises_1.default.mkdir(path_1.default.join(apiDir, '.pluscms'), { recursive: true });
    const probe = path_1.default.join(apiDir, '.pluscms', '.write-test');
    await promises_1.default.writeFile(probe, 'ok');
    await promises_1.default.rm(probe, { force: true });
}
async function preflightInstall(input) {
    const dbHost = String(input.dbHost || '').trim();
    const dbPort = Number(input.dbPort || 3306);
    const dbName = String(input.dbName || '').trim();
    const dbUser = String(input.dbUser || '').trim();
    const dbPass = String(input.dbPass || '');
    const siteUrl = normalizeUrl(input.siteUrl, 'Site URL');
    const hotelName = String(input.hotelName || '').trim() || 'Hotel';
    const nitroUrl = normalizeUrl(input.nitroUrl, 'Nitro URL');
    const adminUsername = normalizeUsername(input.adminUsername);
    const adminEmail = normalizeEmail(input.adminEmail);
    normalizePassword(input.adminPassword, input.confirmPassword);
    if (!dbHost || !dbName || !dbUser)
        throw appError('Database host, name, and user are required.');
    if (!Number.isFinite(dbPort) || dbPort <= 0)
        throw appError('DB Port must be a valid number.');
    const apiDir = process.cwd();
    await assertWritable(apiDir);
    const conn = await promise_1.default.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPass,
        database: dbName,
        multipleStatements: false,
    });
    try {
        await ensureBaseTables(conn);
        await ensureCmsTables(conn);
        return {
            ok: true,
            checks: {
                dbConnection: true,
                hotelTables: true,
                cmsTables: true,
                envWritable: true,
            },
            normalized: { siteUrl, hotelName, nitroUrl, adminUsername, adminEmail },
        };
    }
    finally {
        await conn.end();
    }
}
async function runInstall(input) {
    const dbHost = String(input.dbHost || '').trim();
    const dbPort = Number(input.dbPort || 3306);
    const dbName = String(input.dbName || '').trim();
    const dbUser = String(input.dbUser || '').trim();
    const dbPass = String(input.dbPass || '');
    const siteUrl = normalizeUrl(input.siteUrl, 'Site URL');
    const hotelName = String(input.hotelName || '').trim() || 'Hotel';
    const nitroUrl = normalizeUrl(input.nitroUrl, 'Nitro URL');
    const adminUsername = normalizeUsername(input.adminUsername);
    const adminEmail = normalizeEmail(input.adminEmail);
    const adminPassword = normalizePassword(input.adminPassword, input.confirmPassword);
    if (!dbHost || !dbName || !dbUser)
        throw appError('Database host, name, and user are required.');
    if (!Number.isFinite(dbPort) || dbPort <= 0)
        throw appError('DB Port must be a valid number.');
    const conn = await promise_1.default.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPass,
        database: dbName,
        multipleStatements: false,
    });
    const apiDir = process.cwd();
    await assertWritable(apiDir);
    try {
        await conn.beginTransaction();
        await ensureBaseTables(conn);
        await ensureCmsTables(conn);
        await upsertSetting(conn, 'hotel_name', hotelName);
        await upsertSetting(conn, 'site_url', siteUrl);
        await upsertSetting(conn, 'nitro_url', nitroUrl);
        await upsertSetting(conn, 'beta_mode_enabled', '0');
        const passwordHash = await bcrypt_1.default.hash(adminPassword, 12);
        const adminUserId = await ensureAdminUser(conn, {
            username: adminUsername,
            email: adminEmail,
            passwordHash,
            ip: String(input.requestIp || '127.0.0.1'),
        });
        await conn.commit();
        const jwtSecret = generateSecret(32);
        const twofaKey = generateSecret(32);
        await backupAndWriteEnv(apiDir, {
            PORT: '3001',
            NODE_ENV: 'development',
            JWT_SECRET: jwtSecret,
            AUTH_COOKIE_NAME: 'pluscms_token',
            CORS_ORIGIN: siteUrl,
            USE_HOST_COOKIE_PREFIX: 'false',
            TRUST_PROXY: '1',
            DB_HOST: dbHost,
            DB_PORT: String(dbPort),
            DB_USER: dbUser,
            DB_PASS: dbPass,
            DB_NAME: dbName,
            DB_CONNECTION_LIMIT: '10',
            NITRO_URL: `${nitroUrl.replace(/\/$/, '')}/`,
            TWOFA_ENC_KEY: twofaKey,
            TURNSTILE_SECRET: '',
        });
        return { ok: true, adminUserId };
    }
    catch (error) {
        try {
            await conn.rollback();
        }
        catch { }
        throw error;
    }
    finally {
        await conn.end();
    }
}
