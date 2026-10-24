// Pinned release artifact hashes were verified in the repository's release CI.
// Never trust a checksum fetched alongside a download during installation.
const releases = Object.freeze({
  stable: Object.freeze({
    version: "1.2.0",
    sha256: "a968f88faa2515db024cc10cf439213070ac596a9f1eb823263cbd4461951cbd"
  }),
  preview: Object.freeze({
    version: "1.2.4",
    sha256: "05a715f49fe332ec53c63de80f3ebdabedc8a55c07ce2aa8b000c69ddee2ccec"
  })
});
export function getRelease(channel) {
  const pinned = releases[channel];
  if (!pinned) throw new Error("Expected stable or preview channel");
  return {
    ...pinned, channel,
    url: "https://github.com/sanskarIN/LineLoom/releases/download/v" + pinned.version +
      "/LineLoom-" + pinned.version + ".vsix"
  };
}
