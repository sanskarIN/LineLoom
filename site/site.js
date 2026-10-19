"use strict";
for (const button of document.querySelectorAll("button[data-copy]")) {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy");
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Command copied");
    } catch {
      button.textContent = "Select text";
      button.setAttribute("aria-label", "Select and copy the command manually");
    }
  });
}
