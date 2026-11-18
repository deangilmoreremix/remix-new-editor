#!/usr/bin/env python3
"""Reads the upstream files as PLAIN TEXT (nothing is executed) and checks the transcribed strings occur verbatim."""
import sys, os, re
repo = sys.argv[1]
def src(name): return open(os.path.join(repo, 'scripts', name), encoding='utf-8').read()
def squash(s): return re.sub(r'["\']\s*\n\s*f?["\']', '', s)  # join adjacent string literals split across lines
P, CS, KF, CL, AU, AS = (squash(src(n)) for n in ('provider.py', 'character_sheets.py', 'keyframes.py', 'clips.py', 'audio.py', 'assemble.py'))
checks = [
  ('provider image prefix', P, 'Stylized 3D render, Zack D Films visual aesthetic, plasticine clay subsurface scattering: '),
  ('provider endpoints image', P, '"nano-banana-2"'), ('provider fallback image', P, '"flux-dev"'),
  ('provider clip prompt', P, 'Smooth 3D animation, camera movement {camera_move}. {motion_prompt}'),
  ('provider clip params', P, '"aspect_ratio": "9:16"'), ('provider clip res', P, '"resolution": "720p"'),
  ('provider clip endpoint', P, 'veo3.1-fast-image-to-video'), ('provider clip fallback', P, 'veo3.1-image-to-video'),
  ('provider tts model', P, 'minimax-speech-2.6-turbo'), ('provider tts voice', P, '"voice_id": "male_doc_fast"'), ('provider tts speed', P, '"speed": 1.1'),
  ('sheet prompt a', CS, 'Orthographic 3D character turnaround sheet, front view, side profile view, and 3/4 angle view of {sheet_name.replace(\'_\', \' \')}, stylized 3D digital art style, smooth plasticine shader, clean light grey background, octane render, studio lighting, zero shadows.'),
  ('sheet aspect', CS, 'aspect_ratio="16:9"'),
  ('keyframe prompt', KF, '{scene_desc}, in Zack D 3D stylized animation render style, smooth plasticine shader, dramatic studio key light, vibrant rim lighting, subsurface scattering, macro depth of field.'),
  ('keyframe anchor', KF, ' Anchored on character sheet refs: {\', \'.join(char_refs)}.'),
  ('clip motion prompt', CL, 'Smooth 3D motion, {scene_desc}'),
  ('audio join', AU, '" ".join('),
  ('assemble canvas', AS, 'CANVAS_WIDTH = 720'), ('assemble fps', AS, 'FRAME_RATE = 30'), ('assemble td', AS, 'DEFAULT_TRANSITION_DURATION = 0.35'),
  ('assemble transitions', AS, 'TRANSITIONS = ("fade", "wipeleft", "slideleft", "circleopen")'),
  ('assemble duration rule', AS, 'transition_duration,\n                clip_info[index]["duration"],\n                timeline_duration,'),
  ('assemble acrossfade', AS, 'acrossfade='), ('assemble tri', AS, 'c1=tri:c2=tri'),
  ('assemble real durations', AS, '_duration(ffprobe, shot["path"])'),
  ('assemble zoom', AS, '{CANVAS_WIDTH + 36}:{CANVAS_HEIGHT + 64}:flags=lanczos'),
  ('assemble sample_rates', AS, 'aformat=sample_fmts=fltp:'),
]
bad = [(n, s[:70]) for n, text, s in checks if s not in text]
for n, text, s in checks: print(('OK   ' if s in text else 'MISS ') + n)
sys.exit(1 if bad else 0)
