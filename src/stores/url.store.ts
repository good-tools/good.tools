import { create } from "zustand";

/**
 * URL encoder/decoder store
 * Consolidated store for both encoding and decoding operations
 */
interface URLStore {
  // Encoder state
  encoderInput: string;
  encoderOutput: string;

  // Decoder state
  decoderInput: string;
  decoderOutput: string;

  // Encoder actions
  setEncoderInput: (value: string) => void;
  setEncoderOutput: (value: string) => void;
  resetEncoder: () => void;

  // Decoder actions
  setDecoderInput: (value: string) => void;
  setDecoderOutput: (value: string) => void;
  resetDecoder: () => void;

  // Reset all
  resetAll: () => void;
}

export const useURLStore = create<URLStore>((set) => ({
  // Encoder initial state
  encoderInput: "",
  encoderOutput: "",

  // Decoder initial state
  decoderInput: "",
  decoderOutput: "",

  // Encoder actions
  setEncoderInput: (value) => set({ encoderInput: value }),
  setEncoderOutput: (value) => set({ encoderOutput: value }),
  resetEncoder: () => set({ encoderInput: "", encoderOutput: "" }),

  // Decoder actions
  setDecoderInput: (value) => set({ decoderInput: value }),
  setDecoderOutput: (value) => set({ decoderOutput: value }),
  resetDecoder: () => set({ decoderInput: "", decoderOutput: "" }),

  // Reset all
  resetAll: () =>
    set({
      encoderInput: "",
      encoderOutput: "",
      decoderInput: "",
      decoderOutput: "",
    }),
}));
