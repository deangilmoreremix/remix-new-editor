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

REVERSE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to reverse",
        },
    },
    "required": ["collection_id", "video_id"],
}


class ReverseAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "reverse"
        self.description = "Play video backwards by reversing the playback direction"
        self.parameters = REVERSE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Reverse a video to play it backwards.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to reverse.
        :return: The response with the reversed stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Reversing video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Reversing playback..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id, start=video_duration),
                duration=video_duration,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Video reversed."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error reversing video."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Video reversed successfully.",
            data={"stream_url": stream_url},
        )
