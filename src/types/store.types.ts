/**
 * Base64 encoder/decoder state
 */
export interface Base64State {
  input: string;
  output: Buffer | null;
  setInput: (value: string) => void;
  setOutput: (value: Buffer | null) => void;
  reset: () => void;
}

/**
 * URL encoder/decoder state
 */
export interface URLState {
  input: string;
  output: string;
  setInput: (value: string) => void;
  setOutput: (value: string) => void;
  reset: () => void;
}

/**
 * JSON formatter state
 */
export interface JSONFormatterState {
  value: string;
  parsed: unknown;
  filtered: unknown;
  isValid: boolean;
  jsonPath: string;
  showTree: boolean;
  setValue: (value: string) => void;
  setParsed: (parsed: unknown) => void;
  setFiltered: (filtered: unknown) => void;
  setIsValid: (isValid: boolean) => void;
  setJsonPath: (path: string) => void;
  setShowTree: (show: boolean) => void;
  reset: () => void;
}

/**
 * Packet dissector state
 */
export interface PacketDissectorState {
  file: File | null;
  isLoading: boolean;
  error: string | null;
  packets: unknown[];
  selectedPacket: number | null;
  setFile: (file: File | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPackets: (packets: unknown[]) => void;
  setSelectedPacket: (packet: number | null) => void;
  reset: () => void;
}
