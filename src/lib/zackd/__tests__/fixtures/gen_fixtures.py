#!/usr/bin/env python3
"""Golden fixtures for the Zack D ports.

This file is a hand TRANSCRIPTION of what Anil-matcha/zack-d-films-ai-video-generator does (scripts/provider.py,
character_sheets.py, keyframes.py, clips.py, audio.py, assemble.py): the strings and the ffmpeg graph logic are
copied from those files. It deliberately does NOT import or run the upstream code. verify_against_source.py then
checks (by reading the upstream files as plain text) that every recorded string occurs verbatim in the source.
Usage: gen_fixtures.py <upstream_repo_dir> <out.json>
"""
import json, sys, os
repo, out = sys.argv[1], sys.argv[2]
beats = json.load(open(os.path.join(repo, 'examples', 'swallow_gum_beats.json')))

# ---- provider.py: every generated image gets this prefix; the first endpoint tried is nano-banana-2 -----------------
IMAGE_PREFIX = "Stylized 3D render, Zack D Films visual aesthetic, plasticine clay subsurface scattering: "
def generate_image(prompt, aspect_ratio="9:16"):
    return {"endpoint": "nano-banana-2", "fallback_endpoint": "flux-dev", "payload": {"prompt": IMAGE_PREFIX + prompt, "aspect_ratio": aspect_ratio}}
def animate_image(image_url, motion_prompt, camera_move="push_in"):
    return {"endpoint": "veo3.1-fast-image-to-video", "fallback_endpoint": "veo3.1-image-to-video",
            "payload": {"image_url": image_url, "prompt": f"Smooth 3D animation, camera movement {camera_move}. {motion_prompt}", "aspect_ratio": "9:16", "resolution": "720p"}}
def clone_voice_and_tts(text):
    return {"endpoint": "minimax-speech-2.6-turbo", "payload": {"text": text, "voice_id": "male_doc_fast", "speed": 1.1}}

# ---- character_sheets.py -----------------------------------------------------------------------------------------
sheets = []
for name in beats.get("character_sheets_required", ["main_character_turnaround"]):
    p = (f"Orthographic 3D character turnaround sheet, front view, side profile view, and 3/4 angle view of "
         f"{name.replace('_', ' ')}, stylized 3D digital art style, smooth plasticine shader, "
         f"clean light grey background, octane render, studio lighting, zero shadows.")
    sheets.append({"sheet": name, **generate_image(p, "16:9")})

# ---- keyframes.py ------------------------------------------------------------------------------------------------
aspect = beats.get("aspect_ratio", "9:16")
keyframes, clips = [], []
for beat in beats["beats"]:
    for shot in beat["shots"]:
        prompt = (f"{shot['scene_description']}, in Zack D 3D stylized animation render style, smooth plasticine shader, "
                  f"dramatic studio key light, vibrant rim lighting, subsurface scattering, macro depth of field.")
        refs = shot.get("character_refs", [])
        if refs:
            prompt += f" Anchored on character sheet refs: {', '.join(refs)}."
        keyframes.append({"shot_id": shot["shot_id"], **generate_image(prompt, aspect)})
        # ---- clips.py ----
        cam = shot.get("camera_move", "push_in")
        clips.append({"shot_id": shot["shot_id"], **animate_image("<keyframe-url>", f"Smooth 3D motion, {shot['scene_description']}", cam)})

# ---- audio.py: ONE tts call with every beat's narration joined by a single space ----------------------------------
audio = [clone_voice_and_tts(" ".join(b.get("narration", "") for b in beats["beats"]))]

# ---- assemble.py: _build_filter_graph ------------------------------------------------------------------------------
CANVAS_WIDTH, CANVAS_HEIGHT, FRAME_RATE = 720, 1280, 30
TRANSITIONS = ("fade", "wipeleft", "slideleft", "circleopen")
def _num(v): return f"{v:.6f}".rstrip("0").rstrip(".")
def build_filter_graph(clip_info, transition_duration):
    filters, video_labels, audio_labels = [], [], []
    for info in clip_info:
        duration = _num(info["duration"])
        vl = f"v{len(video_labels)}"
        video = (f"[{info['video_index']}:v]trim=duration={duration},setpts=PTS-STARTPTS,fps={FRAME_RATE},"
                 f"scale={CANVAS_WIDTH}:{CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop={CANVAS_WIDTH}:{CANVAS_HEIGHT},setsar=1,settb=AVTB")
        if info["zoom_impact"]:
            video += (f",scale={CANVAS_WIDTH + 36}:{CANVAS_HEIGHT + 64}:flags=lanczos,crop={CANVAS_WIDTH}:{CANVAS_HEIGHT}:(iw-{CANVAS_WIDTH})/2:(ih-{CANVAS_HEIGHT})/2")
        video += ",format=yuv420p"
        filters.append(f"{video}[{vl}]"); video_labels.append(vl)
        al = f"a{len(audio_labels)}"
        audio = (f"[{info['audio_index']}:a]atrim=duration={duration},asetpts=PTS-STARTPTS,aresample=48000,"
                 "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo")
        filters.append(f"{audio}[{al}]"); audio_labels.append(al)
    if len(video_labels) == 1:
        filters.append(f"[{video_labels[0]}]null[vout]")
    elif transition_duration <= 0:
        filters.append("".join(f"[{l}]" for l in video_labels) + f"concat=n={len(video_labels)}:v=1:a=0[vout]")
    else:
        previous, timeline = video_labels[0], clip_info[0]["duration"]
        for i in range(1, len(video_labels)):
            d = min(transition_duration, clip_info[i]["duration"], timeline)
            out_l = f"vx{i}"
            filters.append(f"[{previous}][{video_labels[i]}]xfade=transition={TRANSITIONS[(i - 1) % len(TRANSITIONS)]}:duration={_num(d)}:offset={_num(timeline - d)}[{out_l}]")
            previous = out_l; timeline += clip_info[i]["duration"] - d
        filters.append(f"[{previous}]null[vout]")
    if len(audio_labels) == 1:
        filters.append(f"[{audio_labels[0]}]anull[aout]")
    elif transition_duration <= 0:
        filters.append("".join(f"[{l}]" for l in audio_labels) + f"concat=n={len(audio_labels)}:v=0:a=1[aout]")
    else:
        previous = audio_labels[0]
        for i in range(1, len(audio_labels)):
            d = min(transition_duration, clip_info[i - 1]["duration"], clip_info[i]["duration"])
            out_l = f"ax{i}"
            filters.append(f"[{previous}][{audio_labels[i]}]acrossfade=d={_num(d)}:c1=tri:c2=tri[{out_l}]")
            previous = out_l
        filters.append(f"[{previous}]anull[aout]")
    return ";".join(filters)

def clip_info(durations, audio_flags, zooms):
    info, nxt = [], 0
    for d, a, z in zip(durations, audio_flags, zooms):
        i = {"duration": d, "has_audio": a, "zoom_impact": z, "video_index": nxt}
        nxt += 1
        if a: i["audio_index"] = i["video_index"]
        else: i["audio_index"] = nxt; nxt += 1   # silent lavfi input follows the clip
        info.append(i)
    return info

zoom = [s["zoom_impact"] for b in beats["beats"] for s in b["shots"]]
scen = {
  "five_clips_all_audio_td035": (clip_info([8.0] * 5, [True] * 5, zoom), 0.35),
  "five_clips_one_without_audio_td035": (clip_info([8.0] * 5, [True, True, False, True, True], zoom), 0.35),
  "five_clips_uneven_durations_td035": (clip_info([8.0, 5.0, 8.0, 4.04, 7.5], [True] * 5, zoom), 0.35),
  "three_clips_hard_cuts": (clip_info([8.0] * 3, [True] * 3, [False, True, False]), 0),
  "single_clip": (clip_info([8.0], [True], [True]), 0.35),
}
fix = {
  "source": "Transcribed from Anil-matcha/zack-d-films-ai-video-generator (scripts/*.py); see verify_against_source.py",
  "beats": beats, "character_sheets": sheets, "keyframes": keyframes, "clips": clips, "audio": audio,
  "filter_graphs": {k: {"clip_info": ci, "transition_duration": td, "graph": build_filter_graph(ci, td)} for k, (ci, td) in scen.items()},
  "assemble_constants": {"CANVAS_WIDTH": 720, "CANVAS_HEIGHT": 1280, "FRAME_RATE": 30, "DEFAULT_TRANSITION_DURATION": 0.35, "VIDEO_CRF": 23, "AUDIO_BITRATE": "96k", "TRANSITIONS": list(TRANSITIONS)},
}
json.dump(fix, open(out, "w"), indent=2, ensure_ascii=False)
print("ok", {k: len(fix[k]) for k in ("character_sheets", "keyframes", "clips", "audio", "filter_graphs")})
