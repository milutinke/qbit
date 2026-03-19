import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  createFocusSlice,
  type FocusSlice,
  selectFocusModeEnabled,
} from "./focus";

describe("Focus Slice", () => {
  const createTestStore = () =>
    create<FocusSlice>()(immer((set, get) => createFocusSlice(set, get)));

  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("initial state", () => {
    it("should have focusModeEnabled set to false", () => {
      expect(store.getState().focusModeEnabled).toBe(false);
    });
  });

  describe("toggleFocusMode", () => {
    it("should toggle from false to true", () => {
      store.getState().toggleFocusMode();
      expect(store.getState().focusModeEnabled).toBe(true);
    });

    it("should toggle from true back to false", () => {
      store.getState().toggleFocusMode();
      store.getState().toggleFocusMode();
      expect(store.getState().focusModeEnabled).toBe(false);
    });
  });

  describe("setFocusMode", () => {
    it("should set focusModeEnabled to true", () => {
      store.getState().setFocusMode(true);
      expect(store.getState().focusModeEnabled).toBe(true);
    });

    it("should set focusModeEnabled to false", () => {
      store.getState().setFocusMode(true);
      store.getState().setFocusMode(false);
      expect(store.getState().focusModeEnabled).toBe(false);
    });
  });

  describe("selectors", () => {
    it("selectFocusModeEnabled should return the current value", () => {
      expect(selectFocusModeEnabled(store.getState())).toBe(false);
      store.getState().toggleFocusMode();
      expect(selectFocusModeEnabled(store.getState())).toBe(true);
    });
  });
});
