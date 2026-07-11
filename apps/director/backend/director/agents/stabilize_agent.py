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

STABILIZE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to stabilize",
        },
        "smoothing_strength": {
            "type": "number",
            "description": "Strength of stabilization (0-1, higher = more stabilization)",
            "default": 0.5,
        },
        "crop": {
            "type": "boolean",
            "description": "Whether to crop the video to remove black borders from stabilization",
            "default": True,
        },
    },
    "required": ["collection_id", "video_id"],
}


class StabilizeAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "stabilize"
        self.description = "Stabilize shaky footage to produce smooth, professional-looking video"
        self.parameters = STABILIZE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        smoothing_strength: float = 0.5,
        crop: bool = True,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Stabilize shaky footage.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to stabilize.
        :param float smoothing_strength: Stabilization strength.
        :param bool crop: Whether to crop borders.
        :return: The response with the stabilized stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Filter

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Stabilizing video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Applying stabilization..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id),
                duration=video_duration,
                filter=Filter.sharpen if crop else None,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Stabilization complete."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error stabilizing video."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Video stabilization completed successfully.",
            data={"stream_url": stream_url},
        )
