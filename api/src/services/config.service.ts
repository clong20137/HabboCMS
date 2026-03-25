import type { Pool } from "mysql2/promise";

import { NITRO_URL, TURNSTILE_ENABLED } from "../env";
import { getCmsSetting } from "../utils/cmsSettings";

export async function getSiteConfig(pool: Pool) {
  const hotelName = await getCmsSetting(pool, "hotel_name", "Hotel");
  return { hotelName };
}

export function getClientConfig() {
  return {
    nitroUrl: NITRO_URL,
    turnstileEnabled: TURNSTILE_ENABLED,
  };
}
