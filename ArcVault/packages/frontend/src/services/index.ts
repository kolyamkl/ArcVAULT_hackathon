import type { IUSYCAdapter, IStableFXAdapter, ICPNAdapter } from "@/types/integrations";
import { RealUSYCAdapter, MockUSYCAdapter } from "./usyc.service";
import { RealStableFXAdapter, MockStableFXAdapter } from "./stablefx.service";
import { RealCPNAdapter, MockCPNAdapter } from "./cpn.service";

const isReal = process.env.INTEGRATION_MODE === "real";

// ── Singletons ───────────────────────────────────────────────────────

let _usyc: IUSYCAdapter | null = null;
let _stablefx: IStableFXAdapter | null = null;
let _cpn: ICPNAdapter | null = null;

export function getUSYCAdapter(): IUSYCAdapter {
  if (!_usyc) {
    _usyc = isReal ? new RealUSYCAdapter() : new MockUSYCAdapter();
  }
  return _usyc;
}

export function getStableFXAdapter(): IStableFXAdapter {
  if (!_stablefx) {
    _stablefx = isReal ? new RealStableFXAdapter() : new MockStableFXAdapter();
  }
  return _stablefx;
}

export function getCPNAdapter(): ICPNAdapter {
  if (!_cpn) {
    _cpn = isReal ? new RealCPNAdapter() : new MockCPNAdapter();
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
