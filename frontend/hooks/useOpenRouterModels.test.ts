import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/models", async () => {
  const actual = await vi.importActual<typeof import("@/lib/models")>("@/lib/models");
  return {
    ...actual,
    fetchModelsForProvider: vi.fn(),
  };
});

import { fetchModelsForProvider, getProviderGroup } from "@/lib/models";
import { useOpenRouterModels } from "./useOpenRouterModels";

const mockFetchModelsForProvider = vi.mocked(fetchModelsForProvider);

describe("useOpenRouterModels", () => {
  beforeEach(() => {
    mockFetchModelsForProvider.mockReset();
  });

  it("loads OpenRouter models from the backend when enabled", async () => {
    mockFetchModelsForProvider.mockResolvedValueOnce([
      { id: "provider/model-a", name: "Model A" },
      { id: "provider/model-b", name: "Model B" },
    ]);

    const { result } = renderHook(() => useOpenRouterModels(true));

    await waitFor(() =>
      expect(result.current.models).toEqual([
        { id: "provider/model-a", name: "Model A" },
        { id: "provider/model-b", name: "Model B" },
      ])
    );
  });

  it("falls back to curated models when fetching fails", async () => {
    const fallbackModels = getProviderGroup("openrouter")?.models ?? [];
    mockFetchModelsForProvider.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useOpenRouterModels(true));

    await waitFor(() => expect(result.current.models).toEqual(fallbackModels));
  });

  it("resets to fallback models when disabled", async () => {
    const fallbackModels = getProviderGroup("openrouter")?.models ?? [];
    mockFetchModelsForProvider.mockResolvedValueOnce([{ id: "provider/model-a", name: "Model A" }]);

    const { result, rerender } = renderHook(({ enabled }) => useOpenRouterModels(enabled), {
      initialProps: { enabled: true },
    });

    await waitFor(() =>
      expect(result.current.models).toEqual([{ id: "provider/model-a", name: "Model A" }])
    );

    await act(async () => {
      rerender({ enabled: false });
    });

    expect(result.current.models).toEqual(fallbackModels);
  });
});
