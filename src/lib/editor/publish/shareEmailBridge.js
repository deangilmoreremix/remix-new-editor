/**
 * Editor-side wiring for the Share panel's email section, kept OUT of TimelineEditorPage.jsx (a protected file) so
 * that file only needs one-line hooks:
 *   - panelOptions(): the mergeTokens / recipient-list callbacks renderSharePanel() uses
 *   - remember():     after publishing or renaming a link, store its URL so the Personalization modal's Email tab prefills it
 */

/**
 * @param {object} o
 *   pub      the publishClient module (the editor imports it lazily and passes it in)
 *   tokens   () => string[]               {{tokens}} the video uses
 *   client   () => Promise<SupabaseClient> signed-in owner client
 *   videoId  () => string|null            the current project's published video id
 */
export function panelOptions({ pub, tokens, client, videoId }) {
  return {
    mergeTokens: () => tokens(),
    parseRecipients: (text) => pub.parseRecipientsCsv(text),
    async saveRecipients(text, { replace } = {}) {
      const parsed = pub.parseRecipientsCsv(text);
      if (parsed.error) throw new Error(parsed.error);
      const id = videoId();
      if (!id) throw new Error('Publish the video first');
      const saved = await pub.saveRecipients(await client(), id, parsed.rows, { replace });
      return { ...parsed, saved };
    },
    async countRecipients() {
      const id = videoId();
      return id ? pub.countRecipients(await client(), id) : 0;
    },
  };
}

/** Stores the video's public URL for the Email tab and returns the video unchanged. */
export function remember(pub, video) {
  pub.rememberPublishedLink(video);
  return video;
}
