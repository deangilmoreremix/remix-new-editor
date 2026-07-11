import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

BROLL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to store the output video",
        },
        "main_video_id": {
            "type": "string",
            "description": "ID of the main video to overlay B-roll onto",
        },
        "broll_video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of B-roll video IDs to overlay",
        },
        "overlay_start_times": {
            "type": "array",
            "items": {"type": "number"},
            "description": "Start times in seconds for each B-roll overlay",
            "default": [],
        },
        "duration": {
            "type": "integer",
            "description": "Duration of each B-roll overlay segment in seconds",
            "default": 5,
        },
        "overlay_volume": {
            "type": "number",
            "description": "Volume level for B-roll audio (0-1)",
            "default": 0.5,
        },
    },
    "required": ["collection_id", "main_video_id", "broll_video_ids"],
}


class BRollAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "broll"
        self.description = "Add B-roll overlay footage over a main video"
        self.parameters = BROLL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        main_video_id: str,
        broll_video_ids: list,
        overlay_start_times: list = None,
        duration: int = 5,
        overlay_volume: float = 0.5,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Add B-roll overlay footage to a video.

        :param str collection_id: The collection ID to use.
        :param str main_video_id: The main video ID to overlay B-roll onto.
        :param list[str] broll_video_ids: List of B-roll video IDs.
        :param list[float] overlay_start_times: Start times for each overlay.
        :param int duration: Duration of each overlay segment.
        :param float overlay_volume: Volume of B-roll audio.
        :return: The response with the combined stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Adding B-roll overlays..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Compositing B-roll..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            timeline.background = "#000000"

            video_track = Track()
            main_video = Clip(asset=VideoAsset(id=main_video_id), duration=30)
            video_track.add_clip(0, main_video)
            timeline.add_track(video_track)

            audio_track = Track()
            if len(broll_video_ids) > 0:
                for i, broll_id in enumerate(broll_video_ids):
                    start = overlay_start_times[i] if overlay_start_times and i < len(overlay_start_times) else i * duration + 5
                    broll_clip = Clip(
                        asset=VideoAsset(id=broll_id, start=0, volume=overlay_volume),
                        duration=duration,
                    )
                    video_track.add_clip(start, broll_clip)

                    broll_audio = Clip(
                        asset=AudioAsset(id=broll_id, start=0, volume=overlay_volume),
                        duration=duration,
                    )
                    audio_track.add_clip(start, broll_audio)
                timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "B-roll ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error adding B-roll."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="B-roll overlay added successfully.",
            data={"stream_url": stream_url},
        )
