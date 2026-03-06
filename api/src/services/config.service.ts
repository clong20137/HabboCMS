import type { Pool } from "mysql2/promise";

import { getCmsSetting } from "../utils/cmsSettings";

export async function getSiteConfig(pool: Pool) {
  const hotelName = await getCmsSetting(pool, "hotel_name", "Hotel");
  return { hotelName };
}

export function getClientConfig() {
  return {
    nitroUrl: process.env.NITRO_URL || "http://localhost:3000",
  };
}
