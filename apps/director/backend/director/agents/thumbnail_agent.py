import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

THUMBNAIL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the video",
        },
        "video_id": {
            "type": "string",
            "description": "The video ID to generate a thumbnail from",
        },
        "timestamp": {
            "type": "integer",
            "description": "Timestamp in seconds to extract the frame from",
            "default": 5,
        },
    },
    "required": ["collection_id", "video_id"],
}


class ThumbnailAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "thumbnail"
        self.description = (
            "Generates a preview thumbnail image from a video at a given timestamp. "
            "Use when a user requests a cover image, thumbnail, or poster frame."
        )
        self.parameters = THUMBNAIL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, timestamp: int = 5, *args, **kwargs):
        try:
            self.output_message.actions.append("Generating thumbnail...")
            self.output_message.push_update()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Extracting frame...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            frame_data = videodb_tool.extract_frame(
                video_id=video_id, timestamp=timestamp
            )

            video_content.status = MsgStatus.success
            video_content.status_message = "Thumbnail generated."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error generating thumbnail."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Thumbnail generated successfully.",
            data=frame_data,
        )
