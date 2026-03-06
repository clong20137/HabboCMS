import type { Pool } from "mysql2/promise";

import { getOnlineCount } from "../repositories/serverStatus.repo";

export async function onlineCount(pool: Pool): Promise<number> {
  return getOnlineCount(pool);
}
