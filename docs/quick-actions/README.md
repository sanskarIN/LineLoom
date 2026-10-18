# LineLoom Quick Actions — v0.6.0

LineLoom's status indicator on the right side of the VS Code status bar opens a native **Quick Actions** picker when clicked. The same picker is available from Command Palette → **LineLoom: Quick Actions**.

| Action | What happens |
| --- | --- |
| Enable / Disable Autocomplete | Turns the entire provider on or off |
| Pause / Resume Automatic Suggestions | Toggles only automatic inference while typing; **manual completion still works** when enabled |
| Trigger Completion | Requests a suggestion explicitly at a valid single cursor |
| Select Model | Requests installed-model information from the validated Ollama endpoint and allows selection |
| Manage Languages | Chooses eligible VS Code editor language modes |
| Check Ollama Connection | Performs a user-requested endpoint connection check |
| Open Diagnostics | Displays configuration and aggregate counters without source snippets |
| Open Settings | Opens VS Code's LineLoom settings panel |

The current enable/automatic settings decide the picker labels. Selecting nothing makes **no configuration change**. Merely opening the picker **does not contact Ollama**. Selecting remote endpoint actions still follows the existing HTTPS and explicit approval checks.

## Automatic pause is not full disable

Pause updates the existing `lineloom.autoTrigger` setting, persists across VS Code sessions and changes the ready indicator to **LineLoom Manual**. Typing no longer initiates a model completion, but the manual **LineLoom: Trigger Completion** command remains available if `lineloom.enabled` is true. Disable Autocomplete instead turns off **all** LineLoom completions. Resume restores automatic typing-triggered requests.

**Pre-release validation note:** unit tests exercise the picker model, and mocked extension-host tests verify the command behavior. Visual menu layout and actual locally installed models require manual testing.
