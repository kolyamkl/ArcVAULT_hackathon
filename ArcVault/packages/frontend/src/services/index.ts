import type { IUSYCAdapter, IStableFXAdapter, ICPNAdapter } from "@/types/integrations";
import { RealUSYCAdapter } from "./usyc.service";
import { RealStableFXAdapter } from "./stablefx.service";
import { RealCPNAdapter } from "./cpn.service";

// ── Singletons ───────────────────────────────────────────────────────

let _usyc: IUSYCAdapter | null = null;
let _stablefx: IStableFXAdapter | null = null;
let _cpn: ICPNAdapter | null = null;

export function getUSYCAdapter(): IUSYCAdapter {
  if (!_usyc) {
    _usyc = new RealUSYCAdapter();
  }
  return _usyc;
}

export function getStableFXAdapter(): IStableFXAdapter {
  if (!_stablefx) {
    _stablefx = new RealStableFXAdapter();
  }
  return _stablefx;
}

export function getCPNAdapter(): ICPNAdapter {
  if (!_cpn) {
    _cpn = new RealCPNAdapter();
  }
  return _cpn;
}

// Re-export chain service functions
export {
  indexContractEvents,
  takeVaultSnapshot,
  getVaultStatus,
  syncPayoutStatuses,
} from "./chain.service";
