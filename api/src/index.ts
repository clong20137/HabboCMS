import { createApp } from "./app";
import { PORT } from "./env";
import { ensureSetupTokenLogged } from "./install/state";

const app = createApp();

app.listen(PORT, async () => {
  console.log(`PlusCMS API running on http://localhost:${PORT}`);
  await ensureSetupTokenLogged();
});
