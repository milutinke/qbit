import { useCallback, useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { fetchModelsForProvider, getProviderGroup, type ModelInfo } from "@/lib/models";

const FALLBACK_OPENROUTER_MODELS = getProviderGroup("openrouter")?.models ?? [];

export function useOpenRouterModels(enabled: boolean): {
  models: ModelInfo[];
  refresh: () => Promise<void>;
} {
  const [models, setModels] = useState<ModelInfo[]>(FALLBACK_OPENROUTER_MODELS);

  const loadModels = useCallback(async () => {
    if (!enabled) {
      setModels(FALLBACK_OPENROUTER_MODELS);
      return;
    }

    try {
      const openrouterModels = await fetchModelsForProvider("openrouter");
      setModels(openrouterModels.length > 0 ? openrouterModels : FALLBACK_OPENROUTER_MODELS);
    } catch (error) {
      logger.warn("Failed to fetch OpenRouter models:", error);
      setModels(FALLBACK_OPENROUTER_MODELS);
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    await loadModels();
  }, [loadModels]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  return { models, refresh };
}
