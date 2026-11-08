// These checksums were taken from independently published GitHub Release assets.
// Never fetch adjacent checksums at installation time. The CLI is separate from VSIX releases.
// The legacy extension publisher stays the default; Sanskar is opt-in for the v1.4.4 preview.
const releases = Object.freeze({
  stable: Object.freeze({
    SanskarCodes: Object.freeze({
      version: "1.3.0",
      publisher: "SanskarCodes",
      asset: "LineLoom-1.3.0.vsix",
      sha256: "6af67d3caab5ae7a86dda574870cccb210fc20fbf105e014ce6532c0ff793e25"
    })
  }),
  preview: Object.freeze({
    SanskarCodes: Object.freeze({
      version: "1.4.4",
      publisher: "SanskarCodes",
      asset: "LineLoom-1.4.4-SanskarCodes.vsix",
      sha256: "517c1f97c16293d2a874fdb09c73d91406da022fd6b17256003b648898c5891f"
    }),
    Sanskar: Object.freeze({
      version: "1.4.4",
      publisher: "Sanskar",
      asset: "LineLoom-1.4.4-Sanskar.vsix",
      sha256: "44ff4754de2d657184dbdb013542ddfef6f0d156f86315ce357751f373e06b89"
    })
  })
});

export function getRelease(channel, publisher = "SanskarCodes") {
  if (channel !== "stable" && channel !== "preview") {
    throw new Error("Expected stable or preview channel");
  }
  if (publisher !== "SanskarCodes" && publisher !== "Sanskar") {
    throw new Error("Expected SanskarCodes or Sanskar publisher");
  }
  const pinned = releases[channel][publisher];
  if (!pinned) {
    throw new Error("Sanskar publisher is available only with --preview");
  }
  return {
    ...pinned, channel,
    url: "https://github.com/sanskarIN/LineLoom/releases/download/v" + pinned.version +
      "/" + pinned.asset
  };
}
