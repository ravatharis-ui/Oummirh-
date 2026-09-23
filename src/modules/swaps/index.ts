/**
 * API publique du module `swaps`.
 *
 * Les autres modules n'importent jamais ce fichier : ils écoutent `swaps.*`.
 */
export { swapsModule } from "./manifest";

export {
  canAdminDecide,
  canCancel,
  canPartnerAnswer,
  isDaySwappable,
  isSwapStatus,
  swapStatusMeta,
  SWAP_STATUSES,
  SWAP_STATUS_META,
  type SwapStatus,
} from "./domain/status";

export { swapRequestSchema, type SwapRequestInput } from "./schemas";
export type { Colleague, MySwapsState, SwapRow, SwappableDay } from "./types";

export { getMySwapsState, getSwapsForAdmin } from "./server/queries";
export { answerSwap, cancelSwap, decideSwap, requestSwap } from "./server/actions";

export { SwapScreen } from "./ui/collab/swap-screen";
export { SwapList } from "./ui/admin/swap-list";
