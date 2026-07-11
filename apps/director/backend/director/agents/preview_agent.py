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

PREVIEW_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to generate a preview for",
        },
        "preview_duration": {
            "type": "integer",
            "description": "Duration of the preview in seconds",
            "default": 30,
        },
        "start_time": {
            "type": "number",
            "description": "Start time in seconds for the preview",
            "default": 0,
        },
    },
    "required": ["collection_id", "video_id"],
}


class PreviewAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "preview"
        self.description = "Generate a short preview of a video"
        self.parameters = PREVIEW_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        preview_duration: int = 30,
        start_time: float = 0,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate a video preview.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to generate preview for.
        :param int preview_duration: Duration of the preview in seconds.
        :param float start_time: Start time for the preview.
        :return: The response with the preview stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Generating video preview..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Generating preview..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id, start=start_time),
                duration=preview_duration,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Preview generated."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error generating preview."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Video preview generated successfully.",
            data={"stream_url": stream_url},
        )
