import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/index.js";

const WASM_PATHS = {
    "single-thread/wllama.wasm": "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/single-thread/wllama.wasm",
    "multi-thread/wllama.wasm": "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/multi-thread/wllama.wasm"
};

const MODEL_REPO = "ngxson/SmolLM2-360M-Instruct-Q8_0-GGUF";
const MODEL_FILE = "smollm2-360m-instruct-q8_0.gguf";

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function roleToChatML(role) {
    if (role === "developer" || role === "system") {
        return "system";
    }
    if (role === "assistant") {
        return "assistant";
    }
    return "user";
}

function validateMessages(messages, label = "messages") {
    if (!Array.isArray(messages)) {
        throw new Error(`${label} must be an array.`);
    }

    const allowedRoles = new Set(["developer", "system", "user", "assistant"]);
    for (const message of messages) {
        if (!message || typeof message !== "object") {
            throw new Error(`${label} must contain objects with role and content.`);
        }
        if (!allowedRoles.has(message.role)) {
            throw new Error("Message role must be developer, user, assistant, or system.");
        }
        if (typeof message.content !== "string") {
            throw new Error("Message content must be a string.");
        }
    }
}

class ModelCoderLLM {
    constructor() {
        this.wllama = null;
        this.isReady = false;
        this.isLoading = false;
        this.statusCallback = null;
        this.streamSessions = new Map();
        this.responsesById = new Map();
    }

    setStatusCallback(callback) {
        this.statusCallback = callback;
    }

    _status(kind, message) {
        if (typeof this.statusCallback === "function") {
            this.statusCallback({ kind, message });
        }
    }

    async initialize(maxRetries = 3) {
        if (this.isReady) {
            return;
        }

        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            try {
                this._status("loading", `Loading local model (attempt ${attempt}/${maxRetries})...`);
                await this._loadModel();
                this.isReady = true;
                this._status("ready", "Model ready: SmolLM2 localmodel");
                this.isLoading = false;
                return;
            } catch (error) {
                lastError = error;
                this._status("error", `Model load failed on attempt ${attempt}: ${error.message}`);
                if (attempt < maxRetries) {
                    await sleep(1200 * attempt);
                }
            }
        }

        this.isLoading = false;
        throw lastError || new Error("Model initialization failed");
    }

    async _loadModel() {
        this.wllama = new Wllama(WASM_PATHS);
        await this.wllama.loadModelFromHF(MODEL_REPO, MODEL_FILE, {
            n_ctx: 2048,
            n_threads: navigator.hardwareConcurrency || 4,
            progressCallback: ({ loaded, total }) => {
                if (!total) {
                    this._status("loading", "Loading local model...");
                    return;
                }
                const pct = Math.round((loaded / total) * 100);
                this._status("loading", `Downloading model: ${pct}%`);
            }
        });
    }

    _ensureClient(model) {
        if (!this.isReady || !this.wllama) {
            throw new Error("Model is not ready yet.");
        }
        if (model !== "localmodel") {
            throw new Error("The model parameter must be 'localmodel'.");
        }
    }

    _toChatML(messages) {
        let prompt = "";
        for (const message of messages) {
            const role = roleToChatML(message.role);
            const content = String(message.content ?? "");
            prompt += `<|im_start|>${role}\n${content}\n<|im_end|>\n\n`;
        }
        prompt += "<|im_start|>assistant\n";
        return prompt;
    }

    _buildResponsesMessages(input, instructions, previousResponseId) {
        const messages = [];
        if (instructions) {
            messages.push({ role: "developer", content: String(instructions) });
        }

        if (previousResponseId && this.responsesById.has(previousResponseId)) {
            messages.push({ role: "assistant", content: this.responsesById.get(previousResponseId) });
        }

        if (Array.isArray(input)) {
            for (const message of input) {
                messages.push({
                    role: String(message.role || "user"),
                    content: String(message.content || "")
                });
            }
        } else {
            messages.push({ role: "user", content: String(input || "") });
        }

        return messages;
    }

    async _complete(prompt, onDelta) {
        await this.wllama.kvClear().catch(() => {});

        let previousText = "";
        let fullText = "";

        const stream = await this.wllama.createCompletion(prompt, {
            nPredict: 320,
            seed: -1,
            sampling: {
                temp: 0.6,
                top_k: 40,
                top_p: 0.92,
                penalty_repeat: 1.05,
                mirostat: 0
            },
            stopTokens: ["<|im_end|>", "<|im_start|>"],
            stream: true
        });

        for await (const chunk of stream) {
            if (!chunk.currentText) {
                continue;
            }

            fullText = chunk.currentText;
            const delta = fullText.slice(previousText.length);
            if (delta && typeof onDelta === "function") {
                onDelta(delta);
            }
            previousText = fullText;
        }

        await this.wllama.kvClear().catch(() => {});
        return fullText.trim();
    }

    async _createStreamSession(prompt, streamType = "responses") {
        const streamId = makeId("stream");
        const responseId = makeId("resp");

        const session = {
            queue: [],
            done: false,
            error: null,
            responseId
        };

        this.streamSessions.set(streamId, session);

        this._complete(prompt, (delta) => {
            if (streamType === "chat") {
                session.queue.push({
                    object: "chat.completion.chunk",
                    choices: [
                        {
                            index: 0,
                            delta: {
                                content: delta
                            }
                        }
                    ]
                });
                return;
            }

            session.queue.push({
                type: "response.output_text.delta",
                delta
            });
        }).then((finalText) => {
            this.responsesById.set(responseId, finalText);
            if (streamType === "chat") {
                session.queue.push({
                    object: "chat.completion.chunk",
                    choices: [
                        {
                            index: 0,
                            delta: {},
                            finish_reason: "stop"
                        }
                    ]
                });
            } else {
                session.queue.push({
                    type: "response.completed",
                    response: {
                        id: responseId,
                        output_text: finalText
                    }
                });
            }
            session.done = true;
        }).catch((error) => {
            session.error = error;
            session.done = true;
        });

        return { stream_id: streamId, response_id: responseId };
    }

    async nextStreamChunk(streamId) {
        const session = this.streamSessions.get(streamId);
        if (!session) {
            return { done: true, chunk: null };
        }

        for (let i = 0; i < 300; i += 1) {
            if (session.queue.length > 0) {
                return { done: false, chunk: session.queue.shift() };
            }

            if (session.done) {
                if (session.error) {
                    const message = session.error.message || "Unknown streaming error";
                    this.streamSessions.delete(streamId);
                    return { done: true, error: message };
                }

                this.streamSessions.delete(streamId);
                return { done: true, chunk: null };
            }

            await sleep(50);
        }

        return { done: false, chunk: null };
    }

    async request(payload) {
        if (!payload || typeof payload !== "object") {
            throw new Error("Invalid request payload.");
        }

        if (payload.type === "chat.completions.create") {
            this._ensureClient(payload.model);
            const messages = Array.isArray(payload.messages) ? payload.messages : [];
            validateMessages(messages, "messages");
            const prompt = this._toChatML(messages);

            if (payload.stream) {
                const streamMeta = await this._createStreamSession(prompt, "chat");
                return {
                    stream: true,
                    stream_id: streamMeta.stream_id,
                    id: streamMeta.response_id
                };
            }

            const outputText = await this._complete(prompt);
            const responseId = makeId("chatcmpl");
            this.responsesById.set(responseId, outputText);

            return {
                id: responseId,
                object: "chat.completion",
                choices: [
                    {
                        index: 0,
                        finish_reason: "stop",
                        message: {
                            role: "assistant",
                            content: outputText
                        }
                    }
                ]
            };
        }

        if (payload.type === "responses.create") {
            this._ensureClient(payload.model);
            const normalizedInstructions = payload.instructions ?? payload.insructions;
            const messages = this._buildResponsesMessages(
                payload.input,
                normalizedInstructions,
                payload.previous_response_id
            );
            validateMessages(messages, "input");
            const prompt = this._toChatML(messages);

            if (payload.stream) {
                const streamMeta = await this._createStreamSession(prompt);
                return {
                    stream: true,
                    stream_id: streamMeta.stream_id,
                    id: streamMeta.response_id
                };
            }

            const outputText = await this._complete(prompt);
            const responseId = makeId("resp");
            this.responsesById.set(responseId, outputText);

            return {
                id: responseId,
                object: "response",
                output_text: outputText,
                output: [
                    {
                        type: "message",
                        role: "assistant",
                        content: [
                            {
                                type: "output_text",
                                text: outputText
                            }
                        ]
                    }
                ]
            };
        }

        throw new Error(`Unsupported request type: ${payload.type}`);
    }
}

const llmRuntime = new ModelCoderLLM();

const host = globalThis;

host.modelCoderSetStatusListener = (callback) => {
    llmRuntime.setStatusCallback(callback);
};

host.modelCoderInit = async (maxRetries = 3) => {
    await llmRuntime.initialize(maxRetries);
};

host.modelCoderRequest = async (requestJson) => {
    const payload = JSON.parse(requestJson);
    const response = await llmRuntime.request(payload);
    return JSON.stringify(response);
};

host.modelCoderNextStreamChunk = async (streamId) => {
    const next = await llmRuntime.nextStreamChunk(streamId);
    return JSON.stringify(next);
};

export default llmRuntime;
