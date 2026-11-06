// These checksums were taken from independently published GitHub Release assets.
// Never fetch adjacent checksums at installation time. The CLI is separate from VSIX releases.
// The legacy extension publisher stays the default; Sanskar is opt-in for the v1.4.3 preview.
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
      version: "1.4.3",
      publisher: "SanskarCodes",
      asset: "LineLoom-1.4.3-SanskarCodes.vsix",
      sha256: "d16b38b90c95fc2aa765543ede7213a42da8b11a1cc15edba7dd11b9e3649fb8"
    }),
    Sanskar: Object.freeze({
      version: "1.4.3",
      publisher: "Sanskar",
      asset: "LineLoom-1.4.3-Sanskar.vsix",
      sha256: "5dbf98d0edcf99ce4cb0ebb30a82efd2b092698ad5a74594c7115d33959acb6b"
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
