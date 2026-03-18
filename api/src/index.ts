import "dotenv/config";

import { createApp } from "./app";
import { ensureSetupTokenLogged } from "./install/state";

const app = createApp();

const port = Number(process.env.PORT || 3001);
app.listen(port, async () => {
  console.log(`PlusCMS API running on http://localhost:${port}`);
  await ensureSetupTokenLogged();
});
