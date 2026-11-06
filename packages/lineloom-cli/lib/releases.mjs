// Every pinned digest is from a published GitHub Release asset, verified separately
// from the download during packaging. Never fetch an adjacent checksum at install time.
// CLI releases are independent of VS Code extension release versions.
//
// v1.4.3 ships different VSIX files for separate extension publisher IDs.
// Keep the existing SanskarCodes publisher pinned for current CLI installs:
// switching to Sanskar requires deliberate user choice, not a silent CLI update.
const releases = Object.freeze({
  stable: Object.freeze({
    version: "1.3.0",
    publisher: "SanskarCodes",
    asset: "LineLoom-1.3.0.vsix",
    sha256: "6af67d3caab5ae7a86dda574870cccb210fc20fbf105e014ce6532c0ff793e25"
  }),
  preview: Object.freeze({
    version: "1.4.3",
    publisher: "SanskarCodes",
    asset: "LineLoom-1.4.3-SanskarCodes.vsix",
    sha256: "d16b38b90c95fc2aa765543ede7213a42da8b11a1cc15edba7dd11b9e3649fb8"
  })
});
export function getRelease(channel) {
  const pinned = releases[channel];
  if (!pinned) throw new Error("Expected stable or preview channel");
  return {
    ...pinned, channel,
    url: "https://github.com/sanskarIN/LineLoom/releases/download/v" + pinned.version +
      "/" + pinned.asset
  };
}
