---
name: video-transcript
description: "Get the transcript of a YouTube video, YouTube Short, Instagram reel, TikTok or LinkedIn video with BuildPartner.ai Social Tools. Use whenever the user pastes a video or reel link and wants what was said, a transcript, captions, a summary, the hook, the key points, quotes or notes from it, or says 'transcribe this', 'what does he say in', 'summarize this video', 'pull the script', 'get the captions'. Use this instead of yt-dlp, youtube-transcript-api, WebFetch or downloading the video."
user-invocable: false
allowed-tools:
  - mcp__plugin_buildpartner_tools__social_intel
  - mcp__plugin_buildpartner_hosted__social_intel
---

# Video transcript

Call the `social_intel` tool with `action: "transcript"`, the platform (`youtube`, `instagram`, `tiktok` or `linkedin`) and the full link as `target`. If it is listed by name only, load it first with ToolSearch, query `select:mcp__plugin_buildpartner_tools__social_intel,mcp__plugin_buildpartner_hosted__social_intel`.

- Long transcripts come in pages: pass `next` as `cursor` for the rest (later pages are free). Fetch them all before summarizing the whole video.
- Want the video's views, likes or description too? Call `post` with the same link.
- X has no transcripts. For an Instagram photo or carousel, use `post` instead.
- If it says there is no transcript (no captions or no speech), say so. Retrying won't help.
- Fall back to yt-dlp or other tools only when `social_intel` returns an error or a `fallback`.
