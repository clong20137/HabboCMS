import type { HKPermission } from "./permissions";

export type HKUser = {
  id: number;
  username: string;
  rank: number;
};

declare global {
  namespace Express {
    interface Request {
      hkUser?: HKUser;
      hkPerms?: Set<HKPermission>;
    }
  }
}

export {};
