use chrono::{DateTime, Duration, Utc};
use parking_lot::RwLock;
use qbit_models::{
    clear_dynamic_models, get_model_capabilities, get_models_for_provider, register_dynamic_model,
    AiProvider, DynamicModelDefinition, OwnedModelDefinition,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::LazyLock;
use tokio::fs;
use tracing::{debug, warn};

const OPENROUTER_MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
const OPENROUTER_MODELS_CACHE_TTL_SECS: i64 = 60 * 60;

static OPENROUTER_MODELS_CACHE: LazyLock<RwLock<Option<OpenRouterModelsCache>>> =
    LazyLock::new(|| RwLock::new(None));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct OpenRouterModelsCache {
    fetched_at: DateTime<Utc>,
    models: Vec<CachedOpenRouterModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct CachedOpenRouterModel {
    id: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModel>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterModel {
    id: String,
    name: Option<String>,
}

pub async fn get_openrouter_models(api_key: Option<&str>) -> Vec<OwnedModelDefinition> {
    let Some(api_key) = api_key.map(str::trim).filter(|key| !key.is_empty()) else {
        return static_openrouter_models();
    };

    if let Some(cache) = get_cached_models(true).await {
        register_openrouter_dynamic_models(&cache.models);
        return owned_models_from_cache(&cache.models);
    }

    match fetch_openrouter_models(api_key).await {
        Ok(models) if !models.is_empty() => {
            let cache = OpenRouterModelsCache {
                fetched_at: Utc::now(),
                models,
            };
            set_memory_cache(cache.clone());
            if let Err(error) = persist_cache(&cache).await {
                warn!("Failed to persist OpenRouter models cache: {error}");
            }
            register_openrouter_dynamic_models(&cache.models);
            owned_models_from_cache(&cache.models)
        }
        Ok(_) => {
            warn!("OpenRouter returned an empty model list; using fallback models");
            stale_cache_or_static_fallback().await
        }
        Err(error) => {
            warn!("Failed to fetch OpenRouter models: {error}");
            stale_cache_or_static_fallback().await
        }
    }
}

async fn stale_cache_or_static_fallback() -> Vec<OwnedModelDefinition> {
    if let Some(cache) = get_cached_models(false).await {
        register_openrouter_dynamic_models(&cache.models);
        return owned_models_from_cache(&cache.models);
    }

    static_openrouter_models()
}

async fn fetch_openrouter_models(
    api_key: &str,
) -> Result<Vec<CachedOpenRouterModel>, reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let response = client
        .get(OPENROUTER_MODELS_URL)
        .bearer_auth(api_key)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await?
        .error_for_status()?
        .json::<OpenRouterModelsResponse>()
        .await?;

    Ok(normalize_openrouter_models(response.data))
}

fn normalize_openrouter_models(models: Vec<OpenRouterModel>) -> Vec<CachedOpenRouterModel> {
    let mut seen_ids = HashSet::new();
    let mut normalized = models
        .into_iter()
        .filter_map(|model| {
            let id = model.id.trim().to_string();
            if id.is_empty() || !seen_ids.insert(id.clone()) {
                return None;
            }

            let display_name = model
                .name
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or(id.as_str())
                .to_string();

            Some(CachedOpenRouterModel { id, display_name })
        })
        .collect::<Vec<_>>();

    normalized.sort_by_cached_key(|model| (model.display_name.to_lowercase(), model.id.clone()));
    normalized
}

fn register_openrouter_dynamic_models(models: &[CachedOpenRouterModel]) {
    clear_dynamic_models(AiProvider::Openrouter);

    for model in models {
        register_dynamic_model(DynamicModelDefinition {
            id: model.id.clone(),
            display_name: model.display_name.clone(),
            provider: AiProvider::Openrouter,
            capabilities: get_model_capabilities(AiProvider::Openrouter, &model.id),
        });
    }
}

fn owned_models_from_cache(models: &[CachedOpenRouterModel]) -> Vec<OwnedModelDefinition> {
    models
        .iter()
        .map(|model| OwnedModelDefinition {
            id: model.id.clone(),
            display_name: model.display_name.clone(),
            provider: AiProvider::Openrouter,
            capabilities: get_model_capabilities(AiProvider::Openrouter, &model.id),
        })
        .collect()
}

fn static_openrouter_models() -> Vec<OwnedModelDefinition> {
    get_models_for_provider(AiProvider::Openrouter)
        .into_iter()
        .map(OwnedModelDefinition::from)
        .collect()
}

async fn get_cached_models(fresh_only: bool) -> Option<OpenRouterModelsCache> {
    let now = Utc::now();

    if let Some(cache) = OPENROUTER_MODELS_CACHE.read().clone() {
        if !fresh_only || is_cache_fresh(&cache, now) {
            return Some(cache);
        }
    }

    let cache = load_cache_from_disk().await?;
    if fresh_only && !is_cache_fresh(&cache, now) {
        return None;
    }

    set_memory_cache(cache.clone());
    Some(cache)
}

async fn load_cache_from_disk() -> Option<OpenRouterModelsCache> {
    let path = cache_file_path()?;
    let contents = fs::read_to_string(path).await.ok()?;
    serde_json::from_str(&contents)
        .map_err(|error| {
            warn!("Failed to parse OpenRouter models cache: {error}");
            error
        })
        .ok()
}

async fn persist_cache(cache: &OpenRouterModelsCache) -> anyhow::Result<()> {
    let Some(path) = cache_file_path() else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    let json = serde_json::to_string_pretty(cache)?;
    fs::write(path, json).await?;
    debug!("Persisted OpenRouter models cache");
    Ok(())
}

fn set_memory_cache(cache: OpenRouterModelsCache) {
    *OPENROUTER_MODELS_CACHE.write() = Some(cache);
}

fn cache_file_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join(".qbit")
            .join("cache")
            .join("openrouter-models.json")
    })
}

fn is_cache_fresh(cache: &OpenRouterModelsCache, now: DateTime<Utc>) -> bool {
    now.signed_duration_since(cache.fetched_at)
        < Duration::seconds(OPENROUTER_MODELS_CACHE_TTL_SECS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_openrouter_models_prefers_names_and_deduplicates_ids() {
        let models = normalize_openrouter_models(vec![
            OpenRouterModel {
                id: "z-provider/model-z".to_string(),
                name: Some("Zed".to_string()),
            },
            OpenRouterModel {
                id: "a-provider/model-a".to_string(),
                name: None,
            },
            OpenRouterModel {
                id: "a-provider/model-a".to_string(),
                name: Some("Ignored duplicate".to_string()),
            },
            OpenRouterModel {
                id: "   ".to_string(),
                name: Some("Blank".to_string()),
            },
        ]);

        assert_eq!(
            models,
            vec![
                CachedOpenRouterModel {
                    id: "a-provider/model-a".to_string(),
                    display_name: "a-provider/model-a".to_string(),
                },
                CachedOpenRouterModel {
                    id: "z-provider/model-z".to_string(),
                    display_name: "Zed".to_string(),
                },
            ]
        );
    }

    #[test]
    fn cache_freshness_uses_one_hour_ttl() {
        let now = Utc::now();
        let fresh_cache = OpenRouterModelsCache {
            fetched_at: now - Duration::minutes(30),
            models: Vec::new(),
        };
        let stale_cache = OpenRouterModelsCache {
            fetched_at: now - Duration::minutes(61),
            models: Vec::new(),
        };

        assert!(is_cache_fresh(&fresh_cache, now));
        assert!(!is_cache_fresh(&stale_cache, now));
    }
}
