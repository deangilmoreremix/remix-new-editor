import logging
import json

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    ContextMessage,
    RoleTypes,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm

logger = logging.getLogger(__name__)

LYRIC_VIDEO_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The music video ID to create a lyric video from",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "style_prompt": {
            "type": "string",
            "description": "Description of the visual style for backgrounds. E.g., 'Calm ocean vibes with pastel colors'",
        },
        "target_segments": {
            "type": "integer",
            "description": "Number of lyric segments to create (usually 1-3)",
            "default": 1,
        },
    },
    "required": ["video_id", "collection_id", "style_prompt"],
}


class LyricVideoAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "lyric_video"
        self.description = (
            "Creates TikTok/Reels/Shorts-style lyric videos from music videos. "
            "Automatically identifies catchy chorus segments with build-up and wind-down, "
            "generates AI backgrounds for each lyric stanza, syncs lyrics with word-level "
            "timing, and outputs vertical 9:16 video clips with pre-roll, CTA, and post-roll."
        )
        self.parameters = LYRIC_VIDEO_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _get_transcript_with_timestamps(self, video_id):
        self.output_message.actions.append("Generating transcript...")
        self.output_message.push_update()
        try:
            return self.videodb_tool.get_transcript(video_id, text=False)
        except Exception:
            self.videodb_tool.index_spoken_words(video_id)
            return self.videodb_tool.get_transcript(video_id, text=False)

    def _identify_segments(self, transcript, style_prompt, target_segments):
        self.output_message.actions.append("Identifying catchy segments...")
        self.output_message.push_update()

        transcript_text = " ".join(w.get("text", "") for w in transcript)

        prompt = f"""
        You are a viral social media content strategist. Given a music video transcript,
        identify the most engaging, catchy, and shareable segments for TikTok/Reels/Shorts.

        # CRITICAL RULES FOR SEGMENT SELECTION
        
        1. **CHORUS-CENTERED**: Every segment must be built around a chorus with proper build-up and wind-down
        2. **NO ABRUPT STARTS**: Always include 2-4 lines BEFORE the chorus begins
        3. **NO ABRUPT ENDS**: Always include 2-4 lines AFTER the chorus ends
        4. **PROFESSIONAL RAMP UP/DOWN**: The segment should feel like a complete emotional journey
        
        # SEGMENT REQUIREMENTS
        - Duration: 15-60 seconds per segment
        - Focus on the catchiest, most repetitive, memorable section
        - Include build-up BEFORE the chorus
        - Include wind-down AFTER the chorus
        
        # STYLE CONTEXT
        User style request: {style_prompt}
        
        # TRANSCRIPT
        {transcript_text}
        
        # OUTPUT FORMAT
        Return ONLY a valid JSON array with this exact structure:
        [
            {{
                "start_time": float (seconds from original video start),
                "end_time": float (seconds from original video end),
                "stanzas": [
                    {{
                        "start": float,
                        "end": float,
                        "lines": [
                            {{"text": "lyric line", "start": float, "end": float}}
                        ]
                    }}
                ]
            }}
        ]
        
        Return 1-{target_segments} segments. Output ONLY the JSON array, no additional text.
        """

        message = ContextMessage(content=prompt, role=RoleTypes.user)
        llm_response = self.llm.chat_completions(
            [message.to_llm_msg()],
            response_format={"type": "json_object"},
        )

        try:
            result = json.loads(llm_response.content)
            return result if isinstance(result, list) else [result]
        except Exception as e:
            logger.error(f"Failed to parse segment response: {e}")
            return []

    def _generate_backgrounds(self, segments, style_prompt):
        self.output_message.actions.append("Generating AI backgrounds for each stanza...")
        self.output_message.push_update()

        backgrounds = []
        for seg_idx, segment in enumerate(segments):
            for stan_idx, stanza in enumerate(segment.get("stanzas", [])):
                lines_text = " ".join(line["text"] for line in stanza.get("lines", []))
                bg_prompt = f"""
                Create a vertical 9:16 background image for a lyric video stanza.
                Style: {style_prompt}
                Mood of lyrics: {lines_text}
                
                Requirements:
                - Vertical 9:16 aspect ratio (portrait for mobile)
                - NO text, words, letters, or written language in the image
                - Keep center vertical strip clear for text overlay
                - Visually striking but not overly distracting
                - Mobile-optimized for small screens
                - Self-contained description (no references to previous images)
                """
                try:
                    bg = self.videodb_tool.generate_image(
                        prompt=bg_prompt, aspect_ratio="9:16"
                    )
                    backgrounds.append({
                        "seg_idx": seg_idx,
                        "stan_idx": stan_idx,
                        "image_id": bg["id"],
                    })
                except Exception as e:
                    logger.error(f"Failed to generate background: {e}")
                    continue

        return backgrounds

    def _build_lyric_timeline(self, video_id, segments, backgrounds):
        from videodb.editor import (
            Timeline,
            Track,
            Clip,
            VideoAsset,
            ImageAsset,
            TextAsset,
            Font,
            Border,
            Alignment,
            HorizontalAlignment,
            VerticalAlignment,
            Position,
            Transition,
            Fit,
        )

        self.output_message.actions.append("Building lyric video timeline...")
        self.output_message.push_update()

        conn = VideoDBTool(self.videodb_tool.collection.id).conn
        timeline = Timeline(conn)
        timeline.resolution = "608x1080"
        timeline.background = "#000000"

        TIMELINE_WIDTH = 608
        TIMELINE_HEIGHT = 1080
        PRE_ROLL = 3.0
        POST_ROLL = 3.0
        CTA_DURATION = 4.0
        LINE_HEIGHT = 45

        for seg_idx, segment in enumerate(segments):
            actual_start = float(segment["start_time"])
            actual_end = float(segment["end_time"])

            timeline_start = max(0, actual_start - PRE_ROLL)
            total_duration = (actual_end - timeline_start) + CTA_DURATION + POST_ROLL
            stanzas = segment.get("stanzas", [])

            seg_backgrounds = [
                b for b in backgrounds if b["seg_idx"] == seg_idx
            ]

            audio_track = Track(z_index=0)
            audio_clip = Clip(
                asset=VideoAsset(id=video_id, start=timeline_start, volume=1.0),
                duration=total_duration,
                fit=Fit.crop,
                position=Position.center,
                opacity=0.0,
                transition=Transition(in_="fade", out="fade", duration=2.0),
            )
            audio_track.add_clip(0, audio_clip)
            timeline.add_track(audio_track)

            images_track = Track(z_index=1)
            for i, stanza in enumerate(stanzas):
                local_start = float(stanza["start"]) - timeline_start
                local_end = float(stanza["end"]) - timeline_start
                local_start = max(0.0, local_start)
                duration = max(0.1, local_end - local_start)

                if i == 0:
                    trans_in = Transition(in_="fade", duration=PRE_ROLL)
                else:
                    trans_in = Transition(in_="fade", out="fade", duration=0.35)

                bg_clip = Clip(
                    asset=ImageAsset(id=seg_backgrounds[i]["image_id"]),
                    duration=duration,
                    fit=Fit.crop,
                    position=Position.center,
                    transition=trans_in,
                )
                images_track.add_clip(local_start, bg_clip)

            timeline.add_track(images_track)

            lyrics_track = Track(z_index=2)
            lyrics_border = Border(color="#000000", width=1.5)

            for i, stanza in enumerate(stanzas):
                stanza_start = float(stanza["start"]) - timeline_start
                stanza_end = float(stanza["end"]) - timeline_start
                lines = stanza.get("lines", [])

                num_lines = len(lines)
                start_pixel_offset = -((num_lines - 1) * LINE_HEIGHT) / 2
                half_height = TIMELINE_HEIGHT / 2

                for l_idx, line in enumerate(lines):
                    line_start = float(line["start"]) - timeline_start
                    line_end = float(line["end"]) - timeline_start
                    line_duration = max(0.1, stanza_end - line_start)

                    pixel_y = start_pixel_offset + (l_idx * LINE_HEIGHT)
                    y_offset = pixel_y / half_height

                    text_asset = TextAsset(
                        text=line["text"],
                        font=Font(family="Clear Sans", size=48, color="#FFFFFF", weight=700),
                        border=lyrics_border,
                        alignment=Alignment(
                            horizontal=HorizontalAlignment.center,
                            vertical=VerticalAlignment.center,
                        ),
                    )

                    lyrics_track.add_clip(
                        start=line_start,
                        clip=Clip(
                            asset=text_asset,
                            duration=line_duration,
                            position=Position.center,
                            offset=Offset(x=0, y=y_offset),
                            transition=Transition(in_="fade", duration=0.3),
                        ),
                    )

            cta_start = actual_end - timeline_start
            cta_lines = ["Like & Follow", "for more!"]
            cta_y_offsets = []
            start_pixel_offset = -((len(cta_lines) - 1) * 60) / 2
            for i in range(len(cta_lines)):
                pixel_y = start_pixel_offset + (i * 60)
                cta_y_offsets.append(pixel_y / half_height)

            for c_idx, cta_text in enumerate(cta_lines):
                cta_asset = TextAsset(
                    text=cta_text,
                    font=Font(family="Clear Sans", size=42, color="#FFFFFF", weight=700),
                    border=lyrics_border,
                    alignment=Alignment(
                        horizontal=HorizontalAlignment.center,
                        vertical=VerticalAlignment.center,
                    ),
                )
                lyrics_track.add_clip(
                    start=cta_start,
                    clip=Clip(
                        asset=cta_asset,
                        duration=CTA_DURATION,
                        position=Position.center,
                        offset=Offset(x=0, y=cta_y_offsets[c_idx]),
                        transition=Transition(in_="fade", duration=0.5),
                    ),
                )

            timeline.add_track(lyrics_track)

        return timeline

    def run(
        self,
        video_id: str,
        collection_id: str,
        style_prompt: str,
        target_segments: int = 1,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating lyric video...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            transcript = self._get_transcript_with_timestamps(video_id)
            segments = self._identify_segments(transcript, style_prompt, target_segments)

            if not segments:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="Could not identify suitable lyric segments. Try a different video or style.",
                )

            backgrounds = self._generate_backgrounds(segments, style_prompt)
            timeline = self._build_lyric_timeline(video_id, segments, backgrounds)
            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Lyric video created!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to create lyric video."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR, message=f"Failed to create lyric video: {str(e)}"
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Lyric video created with {len(segments)} segment(s).",
            data={
                "stream_url": stream_url,
                "segments_count": len(segments),
                "backgrounds_generated": len(backgrounds),
            },
        )
