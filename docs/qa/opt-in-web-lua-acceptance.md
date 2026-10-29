# Experimental HTML, CSS and Lua — manual acceptance

**Status: NOT RUN.** Source-only candidate. No trained model, production quality claim, VSIX publication, registry publication or release approval.

## Automated gates
- Language IDs and per-language model overrides are consistent with the extension manifest.
- HTML, CSS and Lua stay OFF on clean profiles; the nine existing defaults remain unchanged.
- Existing workspace trust, active local file, ignore/exclusion, remote endpoint approval, cancellation, single-cursor and selection requirements remain enforced.

## Physical/editor checks before release
1. On Windows, macOS and Linux, use a real installed local model and a trusted workspace. For Lua, confirm a Lua language provider recognizes the editor mode.
2. Verify `.html`, `.css` and `.lua` files never trigger requests with default settings, including manually invoked suggestions.
3. Opt in one language at a time via Manage Autocomplete Languages; test automatic and manual suggestions with representative markup, selectors and Lua functions, and check for suffix duplication or incorrect indentation.
4. Test optional model overrides, unavailable models and cancellation after a delayed response.
5. Reject inference from ignored and excluded files, virtual/untitled editors, untrusted workspaces, selection replacements, multiple carets and unapproved remote endpoints.
6. Manually inspect completion usefulness, native IntelliSense interaction, keyboard focus, high contrast and screen-reader cues.
7. Record separate dated outcomes for each OS and model, without attaching personal code, paths, prompts, error bodies or credentials.

The first-party LineLoom Code model research track remains limited to Rust, C, C++, Python and TypeScript. Registry tests are not evidence of real-model quality or accessible editor behavior.
