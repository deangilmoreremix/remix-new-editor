# SmartVidDownloader user guide

SmartVidDownloader downloads videos, turns speech into a searchable transcript, and lets you summarize, question, translate and export it. Your OpenAI key powers the AI parts: **you bring your own key**, and the app never stores it on the server.

## Quick start
1. **Add a video.** On **Home**, press **Add URL** and paste a link, or drop a media file to transcribe it.
2. **Open Transcripts.** Pick your video from the list.
3. **Transcribe it.** Press **Transcribe** (or use **From a file** to do it in your browser).
4. **Add your OpenAI key** (next section) to use summaries, chat and translation.
5. **Use the tabs:** *Transcript*, *AI summary*, *Chat*, *Translate*.

## Add your OpenAI key
AI features use **your own OpenAI account**. To add the key:
1. Open any transcript and choose the **AI summary** tab.
2. Press **OpenAI settings**.
3. Paste your key (it starts with `sk-`). Optionally change the **Model ID** (default `gpt-4.1-mini`).
4. Press **Test connection**, then **Save**.

- **Where the key lives.** It is saved **only in this browser** and sent with each AI request over HTTPS. It is never stored on the server. Press **Remove key** to delete it, and do that on shared computers.
- **Costs.** OpenAI bills your account for what you run. Create a key with a spending limit at platform.openai.com. Web search (see Chat) is billed by OpenAI too.
- **What is sent.** Only the transcript text and your question go to OpenAI. Videos and audio stay on the server.

## Download videos (Home)
- Press **Add URL**, paste a video or playlist link, choose the format, and start. Progress appears in the list.
- Downloads are stored on the SmartVidDownloader server, not on your computer.
- If a site needs you to be signed in, open **Settings → Cookies** (the banner on Home links there). See upstream's Cookies guide for how.

## Transcribe
There are two ways. Both end up in **Transcripts**.

**On the server (finished downloads).** Open the download in **Transcripts** and press **Transcribe**. The first time, the speech model is downloaded, which can take a few minutes. Choose the model and language in **Settings → Transcription**. You get a notification when it finishes if you press **Notify me**.

**In your browser ("From a file").** Press **From a file**, pick an audio or video file, choose the **Model** and **Language**, optionally tick **Use the GPU (WebGPU)**, and press **Transcribe**. The file never leaves your computer. Press **Save** to keep the transcript on the server, or **Discard**.

## The transcript page
- **Player (top left):** play the video, see the waveform, and choose captions from the **Captions** menu.
- **Speakers (left tab):** who talked and for how long. Click a coloured bar to jump to that moment.
- **Info (left tab):** title, language, length, file, and **Video with subtitles** export (below).
- **Transcript (right tab):** search box, **Follow playback**, and each line with its speaker and time. Click a time to play from there.
- **Export (top right):** download the transcript as **TXT, MD, SRT or VTT**.
- **Re-transcribe** redoes the transcript if you are not happy with it.

## AI summary
Pick a prompt tab and the result streams in. Built-in tabs: **Overview**, **Chapters** (click a chapter or quote to jump to that moment), **Generate FAQ** and **Create a mindmap**.

Open **All prompts** for more: Bullet Points, Extract Statistics, Improve Grammar & Punctuation, Paraphrase Content, Translate, **Key moments** (clip ideas with times), **Quiz**, **Show notes**, **Social posts**, and **Fact-check (web)**, which checks claims against the web and lists its sources.

Once a result is ready you can **Copy** it, **Save as image**, **Copy image** or **Share…** it, or press **Run again**.

**Edit prompts** opens the prompt list:
- the **Tab** checkbox puts a prompt in the tab row;
- **Edit** changes a prompt's wording, and **Reset** puts a built-in one back;
- **Add prompt** creates your own, and **Delete** removes it;
- **Run on a sample** tries a prompt on a built-in sample interview first (nothing is saved);
- **Restore defaults** resets which prompts show as tabs.

## Chat
Ask questions about the video. The assistant reads the transcript to answer and cites moments like `[2:15]`. Tick **Let the assistant search the web** if you want it to look up facts the video does not contain; those answers end with a **Sources** list. **Clear** starts over.

## Translate
Type a target language (for example *Spanish*) and press **Translate**. Each caption is translated separately so the timing does not change. When it is ready, choose it in the player's **Captions** menu or use it for the subtitle export.

## Video with subtitles
On the **Info** tab, choose the subtitles (the original transcript or a translation) and the style:
- **Soft (selectable track):** subtitles can be turned on and off in the player. Fast.
- **Burned in (re-encodes):** subtitles are drawn on the picture. Slower, and it can take a while for long videos.

Press **Export video**. Only one export runs at a time.

## Tools
**Tools** has **Trim, Convert, Extract audio, Resize / compress** and **Crop & rotate**. They run **in your browser**: your files are not uploaded. A recent Chrome or Edge works best. Large files need enough free memory.

## Subscribe, Settings and About
- **Subscribe:** follow feeds and queue new videos automatically.
- **Settings:** download location, theme (Light, Dark or System), language, cookies, and the transcription model.
- The upstream guide (see the end of this page) covers these in more detail.

## Troubleshooting
| You see | Try this |
| --- | --- |
| "Add an OpenAI API key in AI settings first." | Add your key (see above). Keys are per browser: add it again on a new browser. |
| OpenAI rejects the key | Check the key, your OpenAI billing and the **Model ID**. Press **Test connection**. |
| First transcription is slow | The speech model is being downloaded the first time. |
| The key disappeared | You cleared browser data, or you are in a private window. Add it again. |
| Export or translation seems stuck | Long videos take time. Press **Cancel** and retry, or try the soft subtitle style. |
| A tool does not run | Your browser may lack a feature it needs. Try a recent Chrome or Edge. |

## Upstream guide
SmartVidDownloader is built on **nexmoe/VidBee**, an open-source app (MIT licence). VidBee's own guide describes its desktop app. This is the web edition, so some of the desktop guide does not apply (the `vidbee://` protocol and the browser-extension cookie flow). These pages do:
- Download: https://vidbee.org/docs/download/
- Transcripts: https://vidbee.org/docs/transcribe/
- AI Prompts: https://vidbee.org/docs/ai-prompts/
- Subscriptions: https://vidbee.org/docs/rss/
- Formats and containers: https://vidbee.org/docs/formats/
- Cookies: https://vidbee.org/docs/cookies/
- FAQ: https://vidbee.org/docs/faq/
