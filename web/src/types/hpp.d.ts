declare module "hpp" {
  import type { RequestHandler } from "express";
  const hpp: (options?: any) => RequestHandler;
  export default hpp;
}
