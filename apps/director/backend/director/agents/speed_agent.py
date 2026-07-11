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

SPEED_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to adjust speed for",
        },
        "speed_factor": {
            "type": "number",
            "description": "Speed factor (0.5 = half speed, 2 = double speed)",
            "default": 1.0,
        },
        "preserve_pitch": {
            "type": "boolean",
            "description": "Whether to preserve audio pitch when changing speed",
            "default": True,
        },
    },
    "required": ["collection_id", "video_id"],
}


class SpeedAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "speed"
        self.description = "Adjust video speed for slow motion or fast forward effects"
        self.parameters = SPEED_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        speed_factor: float = 1.0,
        preserve_pitch: bool = True,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Adjust video speed.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to adjust speed for.
        :param float speed_factor: Speed factor.
        :param bool preserve_pitch: Whether to preserve pitch.
        :return: The response with the adjusted stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)
            adjusted_duration = video_duration / speed_factor

            self.output_message.actions.append("Adjusting video speed..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Applying speed adjustment..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=adjusted_duration)
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Speed adjustment complete."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error adjusting speed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Video speed adjusted successfully.",
            data={"stream_url": stream_url, "speed_factor": speed_factor},
        )
