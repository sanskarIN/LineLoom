import { validateEndpoint } from "./endpoint";

/**
 * Before committing a model choice, ensure the Ollama endpoint is STILL the
 * exact one the picker contacted. User settings and remote consent can change
 * while a modal or network lookup is open.
 */
export function isEndpointSelectionCurrent(
  expectedOrigin: string,
  endpointSetting: string,
  allowRemoteEndpoints: boolean,
  isApproved: (origin: string) => boolean
): boolean {
  try {
    const target = validateEndpoint(endpointSetting);
    return target.origin === expectedOrigin &&
      (!target.remote || (allowRemoteEndpoints && isApproved(expectedOrigin)));
  } catch {
    return false;
  }
}
