import {
  type CustomModelSetting,
  type ModelCapabilities,
  type ModelSelection,
  ProviderDriverKind,
  type ServerProviderModel,
  type ServerProviderUpdateRequiredModel,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  getModelSelectionStringOptionValue,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  readCustomModelEntries,
} from "@t3tools/shared/model";
import { compareSemverVersions } from "@t3tools/shared/semver";

import {
  type ClaudeCodeCompatibility,
  type ClaudeCodeProfile,
  decodeClaudeModelAdapter,
  decodeClaudeProfileAdapter,
} from "./ClaudeModelManifest.ts";
import * as ModelCatalog from "@t3tools/provider-core/server/ModelCatalog";
import { BUNDLED_MODEL_MANIFEST, resolveProviderCatalog } from "./ModelManifest.ts";

const CLAUDE = ProviderDriverKind.make("claudeAgent");
const EMPTY_CAPABILITIES: ModelCapabilities = { optionDescriptors: [] };

export interface ClaudeCatalogModel {
  readonly model: ServerProviderModel;
  readonly runtime: ClaudeCodeProfile;
  readonly compatibility: ClaudeCodeCompatibility;
  readonly routedModel?: string;
}

export class ClaudeModelEffortError extends Schema.TaggedError<ClaudeModelEffortError>()(
  "ClaudeModelEffortError",
  { model: Schema.String, effort: Schema.String },
) {
  override get message(): string {
    return `Model ${this.model} does not support reasoning effort ${this.effort}.`;
  }
}

export interface ClaudeModelCatalog {
  readonly models: ReadonlyArray<ClaudeCatalogModel>;
}

function tryResolveClaudeModelCatalog(
  resolved: ModelCatalog.ProviderCatalog | undefined,
): ClaudeModelCatalog | null {
  if (!resolved) return null;

  const models: Array<ClaudeCatalogModel> = [];
  for (const entry of resolved.models) {
    const profile = decodeClaudeProfileAdapter(entry.profileAdapter ?? {});
    const adapter = decodeClaudeModelAdapter(entry.adapter ?? {});
    if (Option.isNone(profile) || Option.isNone(adapter)) return null;
    models.push({
      model: ModelCatalog.catalogServerModel(resolved, entry),
      runtime: profile.value.claudeCode ?? {},
      compatibility: adapter.value.claudeCode ?? {},
    });
  }

  return {
    models,
  };
}

/** Resolve the fallback on each read so its new-model badges can expire. */
export function resolveClaudeModelCatalog(
  catalog: ModelCatalog.ProviderCatalog | undefined,
): ClaudeModelCatalog {
  return (
    tryResolveClaudeModelCatalog(catalog) ??
    tryResolveClaudeModelCatalog(
      resolveProviderCatalog(BUNDLED_MODEL_MANIFEST, CLAUDE) ?? undefined,
    ) ?? {
      models: [],
    }
  );
}

export const BUNDLED_CLAUDE_MODEL_CATALOG = resolveClaudeModelCatalog(undefined);

export function scopeClaudeModelCatalog(
  catalog: ClaudeModelCatalog,
  customModels: ReadonlyArray<CustomModelSetting>,
  routing: Readonly<Record<string, string | undefined>> = {},
): ClaudeModelCatalog {
  const customEntries = readCustomModelEntries(customModels);
  const customAliases = new Set(customEntries.map((entry) => entry.slug.toLowerCase()));

  const builtInModels = catalog.models.map((entry) => {
    if (!entry.model.aliases?.some((alias) => customAliases.has(alias.toLowerCase()))) {
      return entry;
    }
    return {
      ...entry,
      model: {
        ...entry.model,
        aliases: entry.model.aliases.filter((alias) => !customAliases.has(alias.toLowerCase())),
      },
    };
  });
  const builtInSlugs = new Set(builtInModels.map((entry) => entry.model.slug));
  const customCatalogModels: Array<ClaudeCatalogModel> = [];
  for (const entry of customEntries) {
    if (!entry.capabilities || builtInSlugs.has(entry.slug)) continue;
    customCatalogModels.push({
      model: {
        slug: entry.slug,
        name: entry.name,
        isCustom: true,
        capabilities: entry.capabilities,
      },
      runtime: {},
      compatibility: {},
    });
  }

  return {
    models: [...builtInModels, ...customCatalogModels].map((entry) => {
      const role =
        /^(?:ccswitch-|(?:claude-)?)(opus|sonnet|fable|haiku)(?:-\d+(?:[-.]\d+)*)?(?:\[1m\])?$/i.exec(
          entry.model.slug,
        )?.[1];
      const explicitTarget = ["OPUS", "SONNET", "FABLE", "HAIKU"].some(
        (name) =>
          (routing[`ANTHROPIC_DEFAULT_${name}_MODEL`] ?? routing.ANTHROPIC_MODEL) ===
          entry.model.slug,
      );
      const routedModel = explicitTarget
        ? entry.model.slug
        : ((role
            ? (routing[`ANTHROPIC_DEFAULT_${role.toUpperCase()}_MODEL`] ?? routing.ANTHROPIC_MODEL)
            : undefined) ?? entry.model.slug);
      const target = role
        ? (routing[`ANTHROPIC_DEFAULT_${role.toUpperCase()}_MODEL`] ?? routing.ANTHROPIC_MODEL)
        : undefined;
      const routedEntry =
        target !== undefined ||
        (routing.CCSWITCH_CONFIG_REVISION?.trim() && role !== undefined) ||
        /^glm-5\.3-flash(?:\[1m\])?$/i.test(routedModel)
          ? {
              ...entry,
              routedModel,
              model:
                target !== undefined && role && !explicitTarget
                  ? {
                      ...entry.model,
                      name: `${routedModel.replace(/\[1m\]$/i, "")} · ${role[0]!.toUpperCase()}${role.slice(1).toLowerCase()}`,
                      shortName: routedModel.replace(/\[1m\]$/i, ""),
                    }
                  : entry.model,
            }
          : entry;
      if (!/^glm-5\.3-flash(?:\[1m\])?$/i.test(routedModel)) return routedEntry;
      return {
        ...routedEntry,
        routedModel,
        model: {
          ...routedEntry.model,
          capabilities: {
            ...entry.model.capabilities,
            optionDescriptors: (entry.model.capabilities?.optionDescriptors ?? []).map(
              (descriptor) =>
                descriptor.id === "effort" && descriptor.type === "select"
                  ? {
                      ...descriptor,
                      options: descriptor.options
                        .filter((option) =>
                          [
                            "low",
                            "high",
                            "max",
                            ...(descriptor.promptInjectedValues ?? []),
                          ].includes(option.id),
                        )
                        .map((option) => ({ ...option, isDefault: option.id === "high" })),
                    }
                  : descriptor,
            ),
          },
        },
        runtime: {
          ...entry.runtime,
          effortMap: { ...entry.runtime.effortMap, medium: "high", max: "max" },
        },
      };
    }),
  };
}

export function resolveClaudeCatalogModel(
  catalog: ClaudeModelCatalog,
  slugOrAlias: string | null | undefined,
): ClaudeCatalogModel | undefined {
  const value = slugOrAlias?.trim();
  if (!value) return undefined;
  return (
    catalog.models.find((entry) => entry.model.slug === value) ??
    catalog.models.find((entry) =>
      entry.model.aliases?.some((alias) => alias.toLowerCase() === value.toLowerCase()),
    )
  );
}

export function resolveClaudeModelSlug(catalog: ClaudeModelCatalog, slugOrAlias: string): string {
  return resolveClaudeCatalogModel(catalog, slugOrAlias)?.model.slug ?? slugOrAlias;
}

export function getClaudeCatalogModelCapabilities(
  catalog: ClaudeModelCatalog,
  slugOrAlias: string | null | undefined,
): ModelCapabilities {
  return resolveClaudeCatalogModel(catalog, slugOrAlias)?.model.capabilities ?? EMPTY_CAPABILITIES;
}

function isVersionSupported(
  compatibility: ClaudeCodeCompatibility,
  version: string | null | undefined,
): boolean {
  if (!compatibility.minVersion && !compatibility.maxVersionExclusive) return true;
  if (!version) return false;
  if (compatibility.minVersion && compareSemverVersions(version, compatibility.minVersion) < 0) {
    return false;
  }
  return !(
    compatibility.maxVersionExclusive &&
    compareSemverVersions(version, compatibility.maxVersionExclusive) >= 0
  );
}

export function resolveClaudeModelsForVersion(
  catalog: ClaudeModelCatalog,
  version: string | null | undefined,
): ReadonlyArray<ClaudeCatalogModel["model"]> {
  return catalog.models
    .filter((entry) => isVersionSupported(entry.compatibility, version))
    .map((entry) => entry.model);
}

export function resolveClaudeUpdateRequiredModels(
  catalog: ClaudeModelCatalog,
  version: string | null | undefined,
): ReadonlyArray<ServerProviderUpdateRequiredModel> {
  if (!version) return [];
  return catalog.models.flatMap(({ model, compatibility }) => {
    const minVersion = compatibility.minVersion;
    if (model.isLegacy || !minVersion || compareSemverVersions(version, minVersion) >= 0) {
      return [];
    }
    return [
      {
        slug: model.slug,
        name: model.name,
        ...(model.badge ? { badge: model.badge } : {}),
        minVersion,
      },
    ];
  });
}

export function formatClaudeVersionUpgradeMessage(
  catalog: ClaudeModelCatalog,
  version: string | null,
): string | undefined {
  const unavailable = catalog.models
    .filter(
      (entry) =>
        entry.compatibility.minVersion &&
        (!version || compareSemverVersions(version, entry.compatibility.minVersion) < 0),
    )
    .toSorted((left, right) =>
      compareSemverVersions(left.compatibility.minVersion!, right.compatibility.minVersion!),
    )[0];
  if (!unavailable?.compatibility.minVersion) return undefined;
  const versionLabel = version ? `v${version}` : "the installed version";
  return `Claude Code ${versionLabel} is too old for ${unavailable.model.name}. Upgrade to v${unavailable.compatibility.minVersion} or newer to access it.`;
}

export function resolveClaudeCatalogEffort(
  catalog: ClaudeModelCatalog,
  model: string | null | undefined,
  raw: string | null | undefined,
): string | undefined {
  const entry = resolveClaudeCatalogModel(catalog, model);
  if (
    entry?.routedModel !== undefined &&
    /^glm-5\.3-flash(?:\[1m\])?$/i.test(entry.routedModel) &&
    raw &&
    !["low", "medium", "high", "max", "ultrathink"].includes(raw)
  ) {
    throw new ClaudeModelEffortError({ model: entry.routedModel, effort: raw });
  }
  if (/^glm-5\.3-flash(?:\[1m\])?$/i.test(entry?.routedModel ?? "") && raw === "medium")
    return "high";
  if (!resolveClaudeCatalogModel(catalog, model)) {
    const effort = raw?.trim();
    return effort && ["low", "medium", "high", "xhigh", "max"].includes(effort)
      ? effort
      : undefined;
  }

  const caps = getClaudeCatalogModelCapabilities(catalog, model);
  const descriptors = getProviderOptionDescriptors({
    caps,
    ...(raw ? { selections: [{ id: "effort", value: raw }] } : {}),
  });
  const descriptor = descriptors.find((candidate) => candidate.id === "effort");
  const value = getProviderOptionCurrentValue(descriptor);
  return typeof value === "string" ? value : undefined;
}

export function normalizeClaudeCatalogEffort(
  catalog: ClaudeModelCatalog,
  effort: string | null | undefined,
  model: string | null | undefined,
): string | undefined {
  if (!effort) return undefined;
  const effortMap = resolveClaudeCatalogModel(catalog, model)?.runtime.effortMap;
  if (!effortMap || !Object.prototype.hasOwnProperty.call(effortMap, effort)) return effort;
  return effortMap[effort] ?? undefined;
}

export function isClaudeCatalogUltracodeEffort(effort: string | null | undefined): boolean {
  return effort === "ultracode";
}

function resolveClaudeCatalogContextWindow(
  catalog: ClaudeModelCatalog,
  modelSelection: ModelSelection | undefined,
): string | undefined {
  const caps = getClaudeCatalogModelCapabilities(catalog, modelSelection?.model);
  const raw = getModelSelectionStringOptionValue(modelSelection, "contextWindow");
  const descriptors = getProviderOptionDescriptors({
    caps,
    ...(raw ? { selections: [{ id: "contextWindow", value: raw }] } : {}),
  });
  const descriptor = descriptors.find((candidate) => candidate.id === "contextWindow");
  const value = getProviderOptionCurrentValue(descriptor);
  return typeof value === "string" ? value : undefined;
}

export function resolveClaudeCatalogApiModelId(
  catalog: ClaudeModelCatalog,
  modelSelection: ModelSelection,
): string {
  const entry = resolveClaudeCatalogModel(catalog, modelSelection.model);
  const slug = entry?.model.slug ?? modelSelection.model;
  const descriptors = getProviderOptionDescriptors({
    caps: entry?.model.capabilities ?? EMPTY_CAPABILITIES,
    selections: modelSelection.options,
  });
  for (const [optionId, suffixes] of Object.entries(entry?.runtime.modelSuffixes ?? {})) {
    const value = getProviderOptionCurrentValue(
      descriptors.find((descriptor) => descriptor.id === optionId),
    );
    if (typeof value === "string" && suffixes[value]) return `${slug}${suffixes[value]}`;
  }
  return slug;
}

export function resolveClaudeCatalogContextWindowTokens(
  catalog: ClaudeModelCatalog,
  modelSelection: ModelSelection | undefined,
): number | undefined {
  const entry = resolveClaudeCatalogModel(catalog, modelSelection?.model);
  if (!entry) return undefined;
  if (entry.runtime.fixedContextWindowTokens) return entry.runtime.fixedContextWindowTokens;
  const contextWindow = resolveClaudeCatalogContextWindow(catalog, modelSelection);
  return contextWindow ? entry.runtime.contextWindowTokens?.[contextWindow] : undefined;
}
