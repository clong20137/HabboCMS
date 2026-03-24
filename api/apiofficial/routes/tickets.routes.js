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
exports.ticketStatus = exports.ticketsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const auth_1 = require("../auth");
const limiters_1 = require("../middleware/limiters");
const numbers_1 = require("../utils/numbers");
const ticketsService = __importStar(require("../services/tickets.service"));
exports.ticketsRouter = express_1.default.Router();
// GET /api/tickets/my
exports.ticketsRouter.get("/tickets/my", auth_1.requireAuth, async (req, res) => {
    try {
        const u = req.user;
        const limit = (0, numbers_1.clampInt)(req.query.limit, 1, 100, 50);
        const items = await ticketsService.listMyTickets(db_1.pool, { userId: u.id, limit });
        return res.json({ ok: true, items });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("TICKETS MY ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
// GET /api/tickets/:id
exports.ticketsRouter.get("/tickets/:id", auth_1.requireAuth, async (req, res) => {
    try {
        const u = req.user;
        const ticketId = Number(req.params.id);
        if (!Number.isFinite(ticketId) || ticketId <= 0) {
            return res.status(400).json({ error: "Invalid ticket id." });
        }
        const thread = await ticketsService.getTicketThread(db_1.pool, { ticketId, userId: u.id });
        if (!thread)
            return res.status(404).json({ error: "Ticket not found." });
        return res.json({ ok: true, ...thread });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("TICKET THREAD ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
// POST /api/tickets (create)
exports.ticketsRouter.post("/tickets", limiters_1.ticketLimiter, auth_1.requireAuth, async (req, res) => {
    try {
        const u = req.user;
        const type = String(req.body?.type ?? "").trim();
        const message = String(req.body?.message ?? "").trim();
        if (!type)
            return res.status(400).json({ error: "Ticket type is required." });
        if (message.length < 50)
            return res.status(400).json({ error: "Message must be at least 50 characters." });
        if (message.length > 1000)
            return res.status(400).json({ error: "Message cannot exceed 1000 characters." });
        const { ticketId, firstMessageId } = await ticketsService.createTicket(db_1.pool, {
            userId: u.id,
            type,
            message,
        });
        return res.json({
            ok: true,
            id: ticketId,
            type,
            status: "Open",
            message,
            createdAt: new Date().toISOString(),
            firstMessageId,
        });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("CREATE TICKET ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
// POST /api/tickets/:id/messages (reply)
exports.ticketsRouter.post("/tickets/:id/messages", limiters_1.ticketLimiter, auth_1.requireAuth, async (req, res) => {
    try {
        const u = req.user;
        const ticketId = Number(req.params.id);
        if (!Number.isFinite(ticketId) || ticketId <= 0) {
            return res.status(400).json({ error: "Invalid ticket id." });
        }
        const message = String(req.body?.message ?? "").trim();
        if (!message)
            return res.status(400).json({ error: "Message is required." });
        if (message.length > 1000)
            return res.status(400).json({ error: "Message cannot exceed 1000 characters." });
        const { messageId } = await ticketsService.replyToTicket(db_1.pool, {
            ticketId,
            userId: u.id,
            message,
        });
        return res.json({
            ok: true,
            message: {
                id: messageId,
                ticketId,
                senderType: "user",
                senderName: u.username,
                message,
                createdAt: new Date().toISOString(),
            },
        });
    }
    catch (e) {
        const status = Number(e?.status) || 500;
        // eslint-disable-next-line no-console
        console.error("REPLY TICKET ERROR:", e);
        if (status === 404)
            return res.status(404).json({ error: "Ticket not found." });
        if (status === 400)
            return res.status(400).json({ error: String(e?.message || "Bad request") });
        return res.status(500).json({ error: "Server error" });
    }
});
// exported for possible HK use later
exports.ticketStatus = ticketsService.ticketStatus;
