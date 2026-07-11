import logging
import uuid

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool
from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

AUDIO_OVERLAYS_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to add audio overlay to",
        },
        "audio_id": {
            "type": "string",
            "description": "Audio ID to overlay on the video",
        },
        "start_time": {
            "type": "number",
            "description": "Start time in seconds for the audio overlay",
            "default": 0,
        },
        "volume": {
            "type": "number",
            "description": "Volume of the audio overlay (0-1)",
            "default": 0.7,
        },
        "fade_in": {
            "type": "number",
            "description": "Fade-in duration in seconds",
            "default": 0,
        },
        "fade_out": {
            "type": "number",
            "description": "Fade-out duration in seconds",
            "default": 0,
        },
    },
    "required": ["collection_id", "video_id", "audio_id"],
}


class AudioOverlaysAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "audio_overlays"
        self.description = "Add audio overlays/music to a video"
        self.parameters = AUDIO_OVERLAYS_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        audio_id: str,
        start_time: float = 0,
        volume: float = 0.7,
        fade_in: float = 0,
        fade_out: float = 0,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Overlay an audio track onto a video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to overlay audio on.
        :param str audio_id: The audio ID to overlay.
        :param float start_time: Start time for the audio overlay.
        :param float volume: Volume level of the overlay.
        :param float fade_in: Fade-in duration.
        :param float fade_out: Fade-out duration.
        :return: The response with the new stream URL.
        :rtype: AgentResponse
        """
        try:
            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Adding audio overlay..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Compositing audio overlay..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=video_duration)
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            audio_clip = Clip(
                asset=AudioAsset(id=audio_id, start=0, volume=volume),
                duration=video_duration,
            )
            audio_track = Track()
            audio_track.add_clip(start_time, audio_clip)
            timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Audio overlay applied."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error adding audio overlay."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Audio overlay added successfully.",
            data={"stream_url": stream_url},
        )
