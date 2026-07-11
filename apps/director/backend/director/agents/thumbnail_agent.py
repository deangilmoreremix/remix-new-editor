import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, TextContent, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

THUMBNAIL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID containing the video",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to extract the thumbnail/frame from",
        },
        "timestamp": {
            "type": "integer",
            "description": "Timestamp in seconds to extract the frame at. Defaults to 5 seconds.",
            "default": 5,
        },
    },
    "required": ["collection_id", "video_id"],
}


class ThumbnailAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "thumbnail"
        self.description = "Generate a thumbnail image or frame from a video at a given timestamp"
        self.parameters = THUMBNAIL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self, collection_id: str, video_id: str, timestamp: int = 5, *args, **kwargs
    ) -> AgentResponse:
        """
        Extract a thumbnail/frame from a video at the specified timestamp.

        :param str collection_id: The collection ID containing the video.
        :param str video_id: The video ID to extract the frame from.
        :param int timestamp: Timestamp in seconds to extract the frame at.
        :return: The response containing the extracted frame data.
        :rtype: AgentResponse
        """
        try:
            self.output_message.actions.append("Extracting frame..")
            text_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Generating thumbnail..",
            )
            self.output_message.content.append(text_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            frame_data = videodb_tool.extract_frame(
                video_id=video_id, timestamp=timestamp
            )

            text_content.text = f"Thumbnail extracted at {timestamp}s"
            text_content.status = MsgStatus.success
            text_content.status_message = "Thumbnail ready"
            self.output_message.publish()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Showing thumbnail preview..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            video_content.video = VideoData(stream_url=frame_data.get("url", ""))
            video_content.status = MsgStatus.success
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            text_content.status = MsgStatus.error
            text_content.status_message = "Error in extracting thumbnail."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Thumbnail extracted successfully.",
            data=frame_data,
        )
