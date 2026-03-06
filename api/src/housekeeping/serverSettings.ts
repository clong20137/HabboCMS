import type { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { requireHKPermission } from "./middleware";

type ServerSettingRow = RowDataPacket & {
  key: string;
  value: string;
  description: string | null;
};

function normalizeKey(k: any) {
  return String(k ?? "").trim();
}

function normalizeValue(v: any) {
  // server_settings.value is TEXT, allow any string
  return String(v ?? "");
}

export function registerServerSettingsRoutes(hkRouter: Router) {
  /**
   * GET all server settings
   * rank 7 only to access/edit (per your request)
   */
  hkRouter.get(
    "/server-settings",
    requireHKPermission("hk.server_settings.edit"), // rank7-only permission
    async (_req, res) => {
      try {
        const [rows] = await pool.query<ServerSettingRow[]>(
          `
SELECT \`key\`, \`value\`, \`description\`
FROM server_settings
ORDER BY \`key\` ASC
`,
        );

        return res.json({
          ok: true,
          items: rows.map((r) => ({
            key: String(r.key),
            value: String(r.value ?? ""),
            description: r.description ? String(r.description) : "",
          })),
        });
      } catch (e) {
        console.error("HK SERVER SETTINGS LIST ERROR:", e);
        return res.status(500).json({ error: "Server error" });
      }
    },
  );

  /**
   * PUT update one setting value
   * rank 7 only
   */
  hkRouter.put(
    "/server-settings/:key",
    requireHKPermission("hk.server_settings.edit"),
    async (req, res) => {
      try {
        const key = normalizeKey(req.params.key);
        const value = normalizeValue(req.body?.value);

        if (!key) return res.status(400).json({ error: "Key is required." });
        if (key.length > 255)
          return res.status(400).json({ error: "Key is too long." });

        // must exist (don’t silently create random keys)
        const [existing] = await pool.query<RowDataPacket[]>(
          "SELECT `key` FROM server_settings WHERE `key` = ? LIMIT 1",
          [key],
        );
        if (!existing.length) {
          return res.status(404).json({ error: "Setting not found." });
        }

        await pool.query(
          "UPDATE server_settings SET `value` = ? WHERE `key` = ? LIMIT 1",
          [value, key],
        );

        return res.json({ ok: true });
      } catch (e) {
        console.error("HK SERVER SETTINGS UPDATE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
      }
    },
  );
}
