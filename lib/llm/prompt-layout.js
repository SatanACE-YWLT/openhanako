import crypto from "crypto";

function hashStablePrefix(parts) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

export function buildUtilityPromptLayout({
  cacheGroup,
  templateVersion,
  systemPrompt,
  userContent,
}) {
  const stableSystemPrompt = String(systemPrompt || "");
  const stableTemplateVersion = String(templateVersion || "v1");
  const stableCacheGroup = String(cacheGroup || "utility.unknown");
  return {
    systemPrompt: stableSystemPrompt,
    messages: [{ role: "user", content: String(userContent || "") }],
    usageMetadata: {
      cacheStrategy: "utility_template",
      cacheGroup: stableCacheGroup,
      templateVersion: stableTemplateVersion,
      cachePrefixHash: hashStablePrefix({
        cacheStrategy: "utility_template",
        cacheGroup: stableCacheGroup,
        templateVersion: stableTemplateVersion,
        systemPrompt: stableSystemPrompt,
      }),
    },
  };
}

export function attachPromptLayoutMetadata(usageContext, usageMetadata) {
  return {
    ...(usageContext || {}),
    metadata: {
      ...(usageContext?.metadata || {}),
      ...(usageMetadata || {}),
    },
  };
}
