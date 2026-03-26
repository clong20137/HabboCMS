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
exports.ticketStatus = void 0;
exports.statusDbToUi = statusDbToUi;
exports.statusUiToDb = statusUiToDb;
exports.listMyTickets = listMyTickets;
exports.getTicketThread = getTicketThread;
exports.createTicket = createTicket;
exports.replyToTicket = replyToTicket;
const ticketsRepo = __importStar(require("../repositories/tickets.repo"));
function statusDbToUi(s) {
    const v = String(s || "").toLowerCase();
    if (v === "pending")
        return "Pending";
    if (v === "closed")
        return "Closed";
    return "Open";
}
function statusUiToDb(s) {
    const v = String(s || "").toLowerCase();
    if (v === "pending")
        return "pending";
    if (v === "closed")
        return "closed";
    return "open";
}
async function listMyTickets(pool, params) {
    const rows = await ticketsRepo.listTicketsForUser(pool, params);
    return rows.map((t) => ({
        id: Number(t.id),
        type: String(t.type),
        status: statusDbToUi(String(t.status)),
        message: String(t.message ?? ""),
        createdAt: String(t.created_at),
        updatedAt: String(t.updated_at),
    }));
}
async function getTicketThread(pool, params) {
    const ticket = await ticketsRepo.getTicketForUser(pool, params);
    if (!ticket)
        return null;
    const messages = await ticketsRepo.listTicketMessages(pool, params.ticketId);
    return {
        ticket: {
            id: Number(ticket.id),
            type: String(ticket.type),
            status: statusDbToUi(String(ticket.status)),
            createdAt: String(ticket.created_at),
        },
        messages: messages.map((m) => ({
            id: Number(m.id),
            ticketId: Number(m.ticket_id),
            senderType: m.is_staff ? "staff" : "user",
            senderName: String(m.username ?? (m.is_staff ? "Staff" : "You")),
            message: String(m.message ?? ""),
            createdAt: String(m.created_at),
        })),
    };
}
async function createTicket(pool, params) {
    const ticketId = await ticketsRepo.createTicket(pool, {
        userId: params.userId,
        type: params.type,
    });
    const firstMessageId = await ticketsRepo.insertTicketMessage(pool, {
        ticketId,
        userId: params.userId,
        message: params.message,
    });
    return { ticketId, firstMessageId };
}
async function replyToTicket(pool, params) {
    const ticket = await ticketsRepo.getTicketForUser(pool, {
        ticketId: params.ticketId,
        userId: params.userId,
    });
    if (!ticket) {
        const err = new Error("Ticket not found.");
        err.status = 404;
        throw err;
    }
    const status = String(ticket.status || "open").toLowerCase();
    if (status === "closed") {
        const err = new Error("This ticket is closed and cannot be replied to.");
        err.status = 400;
        throw err;
    }
    const messageId = await ticketsRepo.insertTicketMessage(pool, {
        ticketId: params.ticketId,
        userId: params.userId,
        message: params.message,
    });
    await ticketsRepo.touchTicketUpdatedAt(pool, params.ticketId);
    return { messageId };
}
exports.ticketStatus = { statusDbToUi, statusUiToDb };
