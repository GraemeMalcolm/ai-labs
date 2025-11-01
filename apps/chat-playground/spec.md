This is a specification for a web chat app. The app should be a HTML 5 web site with a single HTML file supported by a single JavaScript file for code and a single CSS file for visual themes.

The web page should include a chat pane in which the user can enter questions and see responses.

The app should use the WebLLM module, which should be downloaded via CDN.

When the app first opens, the Microsoft Phi 3 Mini 4K Instruct model should be downloaded and set as the model for the Web LLM chat session. A download progress par should be shown to indicate that the model is initializing with the progress shown as a percentage. The rest of the UI should be disabled until the model has downloaded.

The app should use to support the chat functionality. The model should be given the default system message "You are an AI assistant that helps people find information" and whatever user prompt the user enters. The model's responses should be revealed as though they are being typed, but quickly. With each chat iteration, the system message and up to ten of the previous user prompts and responses should be added to the conversation thread to provide context.

## Browser Compatibility and Fallback Strategy

The app implements robust device detection and fallback mechanisms:

1. **WebGPU Detection**: First attempts to use WebGPU for GPU acceleration with Phi-3 Mini models
2. **WASM Fallback**: If WebGPU is unavailable, attempts to fall back to WebAssembly (WASM) for CPU inference with Phi-1.5 models
3. **Virtual PC Compatibility**: Includes comprehensive WASM compatibility checks to handle virtual environments that may not support:
   - SharedArrayBuffer (required for WASM threading)
   - Cross-origin isolation headers
   - Secure contexts (HTTPS requirements)
   - WebAssembly instantiation and memory allocation

**Important Limitation**: WebLLM version 0.2.46 requires WebGPU context initialization even for WASM fallback. This means virtual machines and environments without proper WebGPU adapter support cannot run AI models, even in CPU-only mode. For virtual PC users, consider:

- Using a physical machine with WebGPU-capable browser (Chrome/Edge)
- Updating to a newer WebLLM version with better WASM-only support
- Using alternative AI inference solutions for virtual environments

The app provides clear error messages and device status indicators to help users understand whether GPU acceleration, WASM fallback, or compatibility issues are affecting their experience.
