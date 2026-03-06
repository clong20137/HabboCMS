import "dotenv/config";

import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PlusCMS API running on http://localhost:${port}`);
});
