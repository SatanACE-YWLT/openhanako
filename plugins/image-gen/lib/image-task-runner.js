import path from "node:path";

export function createTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function errorMessage(err) {
  return err?.message || String(err || "未知错误");
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSessionPath(ctx) {
  const sessionPath = typeof ctx?.sessionPath === "string" ? ctx.sessionPath.trim() : "";
  return sessionPath || null;
}

export function generatedDirForCtx(ctx) {
  return path.join(ctx.dataDir, "generated");
}

export function createSubmitContext(ctx) {
  return {
    dataDir: ctx.dataDir,
    bus: ctx.bus,
    log: ctx.log,
    generatedDir: generatedDirForCtx(ctx),
    config: ctx.config,
  };
}

export function bridgeDeliveryTarget(ctx) {
  const bridge = ctx?.bridgeContext;
  if (bridge?.isBridgeSession !== true || !bridge.platform || !bridge.chatId) return null;
  return {
    kind: "bridge",
    platform: bridge.platform,
    chatId: bridge.chatId,
    ...(bridge.sessionKey ? { sessionKey: bridge.sessionKey } : {}),
    ...(bridge.agentId ? { agentId: bridge.agentId } : {}),
    ...(bridge.chatType ? { chatType: bridge.chatType } : {}),
  };
}

export function buildImageParams(input) {
  return {
    type: "image",
    prompt: input.prompt,
    ...(input.ratio && { ratio: input.ratio }),
    ...(input.resolution && { resolution: input.resolution }),
    ...(input.model && { model: input.model }),
    ...(input.image && { image: input.image }),
  };
}

export function imageDeferredMeta({ prompt, deliveryTarget = null } = {}) {
  return {
    type: "image-generation",
    mediaKind: "image",
    deliveryIntent: "ui_only",
    triggerParentTurn: false,
    prompt,
    ...(deliveryTarget ? { deliveryTarget } : {}),
  };
}

async function adapterIsAvailable(adapter, submitCtx) {
  if (typeof adapter?.checkAuth !== "function") return true;
  try {
    const result = await adapter.checkAuth(submitCtx);
    return result?.ok !== false;
  } catch {
    return false;
  }
}

export async function resolveImageAdapter(input, registry, submitCtx) {
  if (input.provider) return registry.get(input.provider);

  const defaultProvider = submitCtx.config?.get?.("defaultImageModel")?.provider;
  if (defaultProvider) {
    const adapter = registry.get(defaultProvider);
    if (adapter && await adapterIsAvailable(adapter, submitCtx)) return adapter;
  }

  const adapters = registry.getByType("image");
  for (let i = adapters.length - 1; i >= 0; i--) {
    const adapter = adapters[i];
    if (await adapterIsAvailable(adapter, submitCtx)) return adapter;
  }
  return adapters.at(-1) || null;
}

export function markSubmitFailed({ taskId, err, store, ctx }) {
  const message = errorMessage(err);
  store.update(taskId, {
    status: "failed",
    failReason: message,
    submitState: "failed",
    completedAt: new Date().toISOString(),
  });
  ctx.bus.request("deferred:fail", { taskId, error: err }).catch(() => {});
  ctx.bus.request("task:remove", { taskId }).catch(() => {});
  ctx.log?.error?.(`[image-gen] submit failed for ${taskId}:`, message);
}

export async function runSubmitInBackground({ taskId, adapter, params, submitCtx, store, poller, ctx }) {
  try {
    const result = await adapter.submit(params, submitCtx);
    const hasProviderTaskId = typeof result?.taskId === "string" && result.taskId.trim();
    const adapterTaskId = hasProviderTaskId ? result.taskId : taskId;
    const files = Array.isArray(result?.files) ? result.files.filter(Boolean) : [];

    if (!hasProviderTaskId && files.length === 0) {
      throw new Error("图片生成 provider 没有返回 taskId 或文件");
    }

    store.update(taskId, {
      submitState: "submitted",
      adapterTaskId,
      ...(files.length ? { files } : {}),
    });

    if (files.length && typeof poller.checkNow === "function") {
      void poller.checkNow(taskId);
    }
  } catch (err) {
    markSubmitFailed({ taskId, err, store, ctx });
  }
}

function retryError(status, error) {
  return { ok: false, status, error };
}

function isRetryableTaskStatus(status) {
  return status === "failed" || status === "cancelled" || status === "aborted";
}

function normalizeRetryParams(task) {
  if (isObject(task.params) && typeof task.params.prompt === "string" && task.params.prompt.trim()) {
    return { ...task.params, type: "image" };
  }
  if (typeof task.prompt === "string" && task.prompt.trim()) {
    return { type: "image", prompt: task.prompt };
  }
  return null;
}

export async function retryImageTask({ taskId, ctx }) {
  const { registry, store, poller } = ctx?._mediaGen || {};
  if (!registry || !store || !poller) {
    return retryError(503, "图片生成插件未初始化");
  }

  const task = store.get(taskId);
  if (!task) return retryError(404, "task not found");
  if (task.type !== "image") return retryError(400, "only image tasks can be retried here");
  if (task.status === "pending") return retryError(409, "task is already running");
  if (!isRetryableTaskStatus(task.status)) return retryError(409, "task is not retryable");

  const sessionPath = typeof task.sessionPath === "string" && task.sessionPath.trim()
    ? task.sessionPath
    : null;
  if (!sessionPath) return retryError(409, "task has no sessionPath");

  const adapter = registry.get(task.adapterId);
  if (!adapter || typeof adapter.submit !== "function") {
    return retryError(409, `adapter "${task.adapterId}" is unavailable`);
  }

  const params = normalizeRetryParams(task);
  if (!params) return retryError(409, "task has no reusable prompt");

  const prompt = typeof task.prompt === "string" && task.prompt.trim()
    ? task.prompt
    : params.prompt;
  const deliveryTarget = task.deliveryTarget || null;
  const meta = imageDeferredMeta({ prompt, deliveryTarget });

  await ctx.bus.request("deferred:retry", { taskId, sessionPath, meta });

  const now = new Date().toISOString();
  store.update(taskId, {
    status: "pending",
    failReason: null,
    submitState: "submitting",
    adapterTaskId: null,
    files: [],
    sessionFiles: [],
    imageWidth: null,
    imageHeight: null,
    completedAt: null,
    createdAt: now,
    retriedAt: now,
    retryCount: Number(task.retryCount || 0) + 1,
  });

  try {
    await ctx.bus.request("task:register", {
      taskId,
      type: "media-generation",
      parentSessionPath: sessionPath,
      meta,
    });
  } catch {
    // TaskRegistry is runtime visibility only; DeferredResultStore owns delivery.
  }

  poller.add(taskId);

  const submitCtx = createSubmitContext(ctx);
  void runSubmitInBackground({
    taskId,
    adapter,
    params,
    submitCtx,
    store,
    poller,
    ctx,
  });

  return {
    ok: true,
    taskId,
    placeholder: {
      type: "media_generation",
      taskId,
      kind: "image",
      ...(task.batchId ? { batchId: task.batchId } : {}),
      prompt,
      status: "pending",
    },
  };
}
