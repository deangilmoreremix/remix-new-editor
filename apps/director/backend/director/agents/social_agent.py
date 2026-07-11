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

SOCIAL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to create a social media clip from",
        },
        "duration": {
            "type": "integer",
            "description": "Duration of the short-form clip in seconds",
            "default": 60,
        },
        "start_time": {
            "type": "number",
            "description": "Start time in seconds for the clip",
            "default": 0,
        },
        "platform": {
            "type": "string",
            "description": "Target social media platform",
            "enum": ["tiktok", "instagram", "youtube", "twitter", "reels"],
            "default": "reels",
        },
    },
    "required": ["collection_id", "video_id"],
}


class SocialAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "social"
        self.description = "Create short-form social media clips from a video"
        self.parameters = SOCIAL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        duration: int = 60,
        start_time: float = 0,
        platform: str = "reels",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Create a short-form social media clip.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to extract the clip from.
        :param int duration: Duration of the clip in seconds.
        :param float start_time: Start time for the clip.
        :param str platform: Target platform (tiktok, instagram, youtube, twitter, reels).
        :return: The response with the generated stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append(
                f"Creating {platform} social clip.."
            )
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message=f"Generating {platform} clip..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id, start=start_time),
                duration=duration,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = f"{platform.capitalize()} clip ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error creating social clip."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Social media {platform} clip created successfully.",
            data={"stream_url": stream_url, "platform": platform},
        )
