import type { Pool } from "mysql2/promise";

import * as ticketsRepo from "../repositories/tickets.repo";

export function statusDbToUi(s: string): "Open" | "Pending" | "Closed" {
  const v = String(s || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "closed") return "Closed";
  return "Open";
}

export function statusUiToDb(s: string): "open" | "pending" | "closed" {
  const v = String(s || "").toLowerCase();
  if (v === "pending") return "pending";
  if (v === "closed") return "closed";
  return "open";
}

export async function listMyTickets(pool: Pool, params: { userId: number; limit: number }) {
  const rows = await ticketsRepo.listTicketsForUser(pool, params);
  return rows.map((t: any) => ({
    id: Number(t.id),
    type: String(t.type),
    status: statusDbToUi(String(t.status)),
    message: String(t.message ?? ""),
    createdAt: String(t.created_at),
    updatedAt: String(t.updated_at),
  }));
}

export async function getTicketThread(
  pool: Pool,
  params: { ticketId: number; userId: number },
) {
  const ticket = await ticketsRepo.getTicketForUser(pool, params);
  if (!ticket) return null;

  const messages = await ticketsRepo.listTicketMessages(pool, params.ticketId);

  return {
    ticket: {
      id: Number((ticket as any).id),
      type: String((ticket as any).type),
      status: statusDbToUi(String((ticket as any).status)),
      createdAt: String((ticket as any).created_at),
    },
    messages: messages.map((m: any) => ({
      id: Number(m.id),
      ticketId: Number(m.ticket_id),
      senderType: m.is_staff ? "staff" : "user",
      senderName: String(m.username ?? (m.is_staff ? "Staff" : "You")),
      message: String(m.message ?? ""),
      createdAt: String(m.created_at),
    })),
  };
}

export async function createTicket(
  pool: Pool,
  params: { userId: number; type: string; message: string },
): Promise<{ ticketId: number; firstMessageId: number }> {
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

export async function replyToTicket(
  pool: Pool,
  params: { ticketId: number; userId: number; message: string },
): Promise<{ messageId: number }> {
  const ticket = await ticketsRepo.getTicketForUser(pool, {
    ticketId: params.ticketId,
    userId: params.userId,
  });
  if (!ticket) {
    const err = new Error("Ticket not found.");
    (err as any).status = 404;
    throw err;
  }

  const status = String((ticket as any).status || "open").toLowerCase();
  if (status === "closed") {
    const err = new Error("This ticket is closed and cannot be replied to.");
    (err as any).status = 400;
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

export const ticketStatus = { statusDbToUi, statusUiToDb };
