import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export async function listTicketsForUser(
  pool: Pool,
  params: { userId: number; limit: number },
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT
t.id,
t.type,
t.status,
t.created_at,
t.updated_at,
(
SELECT m.message
FROM support_ticket_messages m
WHERE m.ticket_id = t.id
ORDER BY m.created_at ASC
LIMIT 1
) AS message
FROM support_tickets t
WHERE t.user_id = ?
ORDER BY t.created_at DESC
LIMIT ?
`,
    [params.userId, params.limit],
  );
  return rows;
}

export async function getTicketForUser(
  pool: Pool,
  params: { ticketId: number; userId: number },
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, status, created_at FROM support_tickets WHERE id = ? AND user_id = ? LIMIT 1",
    [params.ticketId, params.userId],
  );
  return rows.length ? (rows[0] as any) : null;
}

export async function listTicketMessages(
  pool: Pool,
  ticketId: number,
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT
m.id,
m.ticket_id,
m.message,
m.created_at,
CASE WHEN m.user_id IS NULL THEN 1 ELSE 0 END AS is_staff,
COALESCE(u.username, 'Staff') AS username
FROM support_ticket_messages m
LEFT JOIN users u ON u.id = m.user_id
WHERE m.ticket_id = ?
ORDER BY m.created_at ASC
`,
    [ticketId],
  );
  return rows;
}

export async function createTicket(
  pool: Pool,
  params: { userId: number; type: string },
): Promise<number> {
  const [r1] = await pool.query<ResultSetHeader>(
    "INSERT INTO support_tickets (user_id, type, status, created_at, updated_at) VALUES (?, ?, 'open', NOW(), NOW())",
    [params.userId, params.type],
  );
  return Number(r1.insertId);
}

export async function insertTicketMessage(
  pool: Pool,
  params: { ticketId: number; userId: number | null; message: string },
): Promise<number> {
  const [r] = await pool.query<ResultSetHeader>(
    "INSERT INTO support_ticket_messages (ticket_id, user_id, message, created_at) VALUES (?, ?, ?, NOW())",
    [params.ticketId, params.userId, params.message],
  );
  return Number(r.insertId);
}

export async function touchTicketUpdatedAt(pool: Pool, ticketId: number): Promise<void> {
  await pool.query("UPDATE support_tickets SET updated_at = NOW() WHERE id = ? LIMIT 1", [
    ticketId,
  ]);
}
