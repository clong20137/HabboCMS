import express from "express";

import { pool } from "../db";
import { requireAuth } from "../auth";
import { ticketLimiter } from "../middleware/limiters";
import { clampInt } from "../utils/numbers";
import * as ticketsService from "../services/tickets.service";

export const ticketsRouter = express.Router();

// GET /api/tickets/my
ticketsRouter.get("/tickets/my", requireAuth, async (req, res) => {
  try {
    const u = (req as any).user as { id: number; username: string; rank: number };
    const limit = clampInt(req.query.limit, 1, 100, 50);

    const items = await ticketsService.listMyTickets(pool, { userId: u.id, limit });

    return res.json({ ok: true, items });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("TICKETS MY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tickets/:id
ticketsRouter.get("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const u = (req as any).user as { id: number; username: string; rank: number };
    const ticketId = Number(req.params.id);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: "Invalid ticket id." });
    }

    const thread = await ticketsService.getTicketThread(pool, { ticketId, userId: u.id });
    if (!thread) return res.status(404).json({ error: "Ticket not found." });

    return res.json({ ok: true, ...thread });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("TICKET THREAD ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tickets (create)
ticketsRouter.post("/tickets", ticketLimiter, requireAuth, async (req, res) => {
  try {
    const u = (req as any).user as { id: number; username: string; rank: number };

    const type = String(req.body?.type ?? "").trim();
    const message = String(req.body?.message ?? "").trim();

    if (!type) return res.status(400).json({ error: "Ticket type is required." });
    if (message.length < 50)
      return res.status(400).json({ error: "Message must be at least 50 characters." });
    if (message.length > 1000)
      return res.status(400).json({ error: "Message cannot exceed 1000 characters." });

    const { ticketId, firstMessageId } = await ticketsService.createTicket(pool, {
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
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("CREATE TICKET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tickets/:id/messages (reply)
ticketsRouter.post(
  "/tickets/:id/messages",
  ticketLimiter,
  requireAuth,
  async (req, res) => {
    try {
      const u = (req as any).user as { id: number; username: string; rank: number };
      const ticketId = Number(req.params.id);
      if (!Number.isFinite(ticketId) || ticketId <= 0) {
        return res.status(400).json({ error: "Invalid ticket id." });
      }

      const message = String(req.body?.message ?? "").trim();
      if (!message) return res.status(400).json({ error: "Message is required." });
      if (message.length > 1000)
        return res.status(400).json({ error: "Message cannot exceed 1000 characters." });

      const { messageId } = await ticketsService.replyToTicket(pool, {
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
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      // eslint-disable-next-line no-console
      console.error("REPLY TICKET ERROR:", e);
      if (status === 404) return res.status(404).json({ error: "Ticket not found." });
      if (status === 400) return res.status(400).json({ error: String(e?.message || "Bad request") });
      return res.status(500).json({ error: "Server error" });
    }
  },
);

// exported for possible HK use later
export const ticketStatus = ticketsService.ticketStatus;
