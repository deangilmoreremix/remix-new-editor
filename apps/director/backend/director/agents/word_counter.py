import logging
import json

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

WORD_COUNTER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The video ID to count words in",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "keyword": {
            "type": "string",
            "description": "The keyword to count occurrences of",
        },
        "audio_cue_audio_id": {
            "type": "string",
            "description": "Optional audio ID for a sound effect to play on each occurrence",
            "default": None,
        },
    },
    "required": ["video_id", "collection_id", "keyword"],
}


class WordCounterAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "word_counter"
        self.description = (
            "Creates videos that visualize keyword occurrences in real-time. "
            "Searches for a specific word or phrase in a video and overlays "
            "synchronized text counters at each occurrence. Perfect for educational "
            "videos, speech analysis, and content analytics."
        )
        self.parameters = WORD_COUNTER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        video_id: str,
        collection_id: str,
        keyword: str,
        audio_cue_audio_id: str = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Counting keyword occurrences...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            from videodb.editor import (
                Timeline,
                Track,
                Clip,
                VideoAsset,
                AudioAsset,
                TextAsset,
                Font,
                Background,
                Alignment,
                HorizontalAlignment,
                VerticalAlignment,
                Position,
                Offset,
            )

            search_result = self.videodb_tool.keyword_search(
                query=keyword,
                video_id=video_id,
            )

            try:
                shots = search_result.get_shots()
            except Exception:
                shots = []

            if not shots:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message=f"No occurrences of '{keyword}' found in the video.",
                )

            video_duration = min(300, float(self.videodb_tool.get_video(video_id).get("length", 300)))
            audio_offset = 1

            timeline = Timeline(self.videodb_tool.conn)
            video_track = Track()
            text_track = Track()
            audio_track = Track()

            video_clip = Clip(
                asset=VideoAsset(id=video_id, start=0),
                duration=video_duration,
            )
            video_track.add_clip(0, video_clip)

            shots_in_range = [s for s in shots if float(s.start) + audio_offset < video_duration]

            for i, shot in enumerate(shots_in_range):
                trigger_time = float(shot.start) + audio_offset

                if i == 0 and trigger_time > 0:
                    text_asset = TextAsset(
                        text=f"Count-0",
                        font=Font(family="Clear Sans", size=72, color="#000100"),
                        background=Background(color="#F702A4", opacity=1.0),
                        alignment=Alignment(
                            horizontal=HorizontalAlignment.right,
                            vertical=VerticalAlignment.top,
                        ),
                    )
                    text_clip = Clip(
                        asset=text_asset,
                        duration=trigger_time,
                        position=Position.top_right,
                        offset=Offset(x=-0.05, y=0.05),
                    )
                    text_track.add_clip(0, text_clip)

                if i + 1 < len(shots_in_range):
                    next_trigger = float(shots_in_range[i + 1].start) + audio_offset
                else:
                    next_trigger = video_duration

                text_dur = next_trigger - trigger_time

                text_asset = TextAsset(
                    text=f"Count-{i + 1}",
                    font=Font(family="Clear Sans", size=72, color="#000100"),
                    background=Background(color="#F702A4", opacity=1.0),
                    alignment=Alignment(
                        horizontal=HorizontalAlignment.right,
                        vertical=VerticalAlignment.top,
                    ),
                )
                text_clip = Clip(
                    asset=text_asset,
                    duration=text_dur,
                    position=Position.top_right,
                    offset=Offset(x=-0.05, y=0.05),
                )
                text_track.add_clip(trigger_time, text_clip)

                if audio_cue_audio_id and trigger_time < video_duration - 2:
                    audio_clip = Clip(
                        asset=AudioAsset(id=audio_cue_audio_id),
                        duration=2,
                    )
                    audio_track.add_clip(trigger_time, audio_clip)

            timeline.add_track(video_track)
            timeline.add_track(text_track)
            timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = f"Found {len(shots_in_range)} occurrences of '{keyword}'"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to create word counter video."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR,
                message=f"Failed to create word counter video: {str(e)}",
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Word counter video created. Found {len(shots_in_range)} occurrences of '{keyword}'.",
            data={
                "stream_url": stream_url,
                "keyword": keyword,
                "occurrences": len(shots_in_range),
            },
        )
