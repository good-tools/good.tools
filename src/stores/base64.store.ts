import { create } from "zustand";

/**
 * Base64 encoder/decoder store
 * Consolidated store for both encoding and decoding operations
 */
interface Base64Store {
  // Encoder state
  encoderInput: string;
  encoderOutput: Buffer | null;

  // Decoder state
  decoderInput: string;
  decoderOutput: Buffer | null;

  // Encoder actions
  setEncoderInput: (value: string) => void;
  setEncoderOutput: (value: Buffer | null) => void;
  resetEncoder: () => void;

  // Decoder actions
  setDecoderInput: (value: string) => void;
  setDecoderOutput: (value: Buffer | null) => void;
  resetDecoder: () => void;

  // Reset all
  resetAll: () => void;
}

export const useBase64Store = create<Base64Store>((set) => ({
  // Encoder initial state
  encoderInput: "",
  encoderOutput: null,

  // Decoder initial state
  decoderInput: "",
  decoderOutput: null,

  // Encoder actions
  setEncoderInput: (value) => set({ encoderInput: value }),
  setEncoderOutput: (value) => set({ encoderOutput: value }),
  resetEncoder: () => set({ encoderInput: "", encoderOutput: null }),

  // Decoder actions
  setDecoderInput: (value) => set({ decoderInput: value }),
  setDecoderOutput: (value) => set({ decoderOutput: value }),
  resetDecoder: () => set({ decoderInput: "", decoderOutput: null }),

  // Reset all
  resetAll: () =>
    set({
      encoderInput: "",
      encoderOutput: null,
      decoderInput: "",
      decoderOutput: null,
    }),
}));
