import logging
import json
import random

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool
from director.llm import get_default_llm

logger = logging.getLogger(__name__)

ANNUAL_RECAP_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "The collection ID to generate the annual recap for",
        },
        "background_music_audio_id": {
            "type": "string",
            "description": "Optional audio ID for background music",
            "default": None,
        },
        "max_videos": {
            "type": "integer",
            "description": "Maximum number of videos to include in the recap",
            "default": 40,
        },
    },
    "required": ["collection_id"],
}


class AnnualRecapAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "annual_recap"
        self.description = (
            "Transforms video analytics into a cinematic recap video. Calculates metrics "
            "like total minutes uploaded, searches performed, clips generated, and scenes "
            "analyzed. Creates dynamic mosaic/grid effects with video clips, zoom animations, "
            "and text overlays. Perfect for annual reports, marketing recaps, and team celebrations."
        )
        self.parameters = ANNUAL_RECAP_AGENT_PARAMETERS
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def _get_videos(self, collection_id, max_videos):
        self.output_message.actions.append("Loading video collection...")
        self.output_message.push_update()
        videodb_tool = VideoDBTool(collection_id=collection_id)
        videos = videodb_tool.get_videos()
        if not videos:
            return []
        return videos[:max_videos]

    def _calculate_metrics(self, videos):
        total_seconds = sum(float(v.get("length", 0)) for v in videos)
        total_minutes = round(total_seconds / 60, 1)
        total_hours = round(total_minutes / 60, 1)
        total_days = round(total_hours / 24, 1)

        return {
            "total_minutes": total_minutes,
            "total_hours": total_hours,
            "total_days": total_days,
            "video_count": len(videos),
        }

    def _build_timeline(self, collection_id, videos, metrics, background_music_audio_id):
        from videodb.editor import (
            Timeline,
            Track,
            Clip,
            VideoAsset,
            AudioAsset,
            TextAsset,
            Font,
            Filter,
            Transition,
            Position,
            Offset,
            Fit,
        )

        self.output_message.actions.append("Building cinematic recap timeline...")
        self.output_message.push_update()

        conn = VideoDBTool(collection_id=collection_id).conn
        timeline = Timeline(conn)
        timeline.background = "#E85E00"

        main_track = Track()
        text_track = Track()
        audio_track = Track()

        current_time = 0

        intro_text = Clip(
            asset=TextAsset(
                text="YEAR IN FRAMES",
                font=Font(family="Clear Sans", size=60, color="#FFFFFF"),
            ),
            duration=4,
            transition=Transition(in_="fade", out="fade", duration=1),
        )
        text_track.add_clip(1, intro_text)

        if background_music_audio_id:
            music_clip = Clip(
                asset=AudioAsset(id=background_music_audio_id, start=0, volume=1),
                duration=60,
            )
            audio_track.add_clip(4, music_clip)

        section1_text = Clip(
            asset=TextAsset(
                text=f"{metrics['total_minutes']:,} minutes\nof video content.\n\nThat's {metrics['total_hours']} hours.\nOr {metrics['total_days']} full days.",
                font=Font(family="Clear Sans", size=48, color="#FFFFFF"),
            ),
            duration=6,
        )
        text_track.add_clip(6, section1_text)

        for i in range(min(15, len(videos))):
            video = random.choice(videos)
            video_start = random.randint(5, max(6, int(float(video.get("length", 10)) - 5)))
            video_clip = Clip(
                asset=VideoAsset(
                    id=video["id"],
                    start=video_start,
                    volume=0.15,
                ),
                duration=1,
                scale=0.5 + (i * 0.03),
                fit=Fit.crop,
                filter=Filter.greyscale,
                offset=Offset(
                    x=random.uniform(-0.5, 0.5),
                    y=random.uniform(-0.5, 0.5),
                ),
            )
            main_track.add_clip(6 + (i * 0.2), video_clip)

        section2_text = Clip(
            asset=TextAsset(
                text=f"{metrics['video_count']} videos uploaded.\n\nEvery frame tells a story.",
                font=Font(family="Clear Sans", size=52, color="#FFFFFF"),
            ),
            duration=5,
        )
        text_track.add_clip(22, section2_text)

        for i in range(min(10, len(videos))):
            video = random.choice(videos)
            video_start = random.randint(5, max(6, int(float(video.get("length", 10)) - 5)))
            video_clip = Clip(
                asset=VideoAsset(
                    id=video["id"],
                    start=video_start,
                    volume=0.1,
                ),
                duration=2,
                scale=1.2,
                fit=Fit.crop,
                filter=Filter.greyscale,
                opacity=0.3,
            )
            main_track.add_clip(22 + (i * 0.5), video_clip)

        outro_text = Clip(
            asset=TextAsset(
                text="Ready for next year?\nKeep creating!",
                font=Font(family="Clear Sans", size=56, color="#FFFFFF"),
            ),
            duration=3,
        )
        text_track.add_clip(35, outro_text)

        timeline.add_track(main_track)
        timeline.add_track(text_track)
        timeline.add_track(audio_track)

        return timeline

    def run(
        self,
        collection_id: str,
        background_music_audio_id: str = None,
        max_videos: int = 40,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating annual recap video...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videos = self._get_videos(collection_id, max_videos)
            if not videos:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No videos found in collection.",
                )

            metrics = self._calculate_metrics(videos)
            timeline = self._build_timeline(
                collection_id, videos, metrics, background_music_audio_id
            )

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Annual recap video created!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to create annual recap."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR,
                message=f"Failed to create annual recap: {str(e)}",
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Annual recap video created successfully!",
            data={
                "stream_url": stream_url,
                "metrics": metrics,
            },
        )
