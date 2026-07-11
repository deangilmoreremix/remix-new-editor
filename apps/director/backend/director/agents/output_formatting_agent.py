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

OUTPUT_FORMATTING_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to format",
        },
        "output_format": {
            "type": "string",
            "description": "Output video format",
            "enum": ["mp4", "webm", "mov"],
            "default": "mp4",
        },
        "resolution": {
            "type": "string",
            "description": "Output resolution",
            "enum": ["1920x1080", "1280x720", "3840x2160", "1080x1920"],
            "default": "1920x1080",
        },
        "style_preset": {
            "type": "string",
            "description": "Visual style preset to apply",
            "enum": ["cinematic", "social_media", "documentary", "vintage", "none"],
            "default": "cinematic",
        },
    },
    "required": ["collection_id", "video_id"],
}


class OutputFormattingAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "output_formatting"
        self.description = "Format and style output video with resolution, aspect ratio, and visual presets"
        self.parameters = OUTPUT_FORMATTING_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        output_format: str = "mp4",
        resolution: str = "1920x1080",
        style_preset: str = "cinematic",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Format and style the output video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to format.
        :param str output_format: Output format.
        :param str resolution: Output resolution.
        :param str style_preset: Style preset.
        :return: The response with the formatted stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Filter

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Formatting output video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Applying output formatting..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            filter_map = {
                "cinematic": Filter.contrast,
                "social_media": Filter.grayscale,
                "documentary": Filter.sepia,
                "vintage": Filter.vintage,
                "none": None,
            }
            active_filter = filter_map.get(style_preset)

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(
                asset=VideoAsset(id=video_id),
                duration=video_duration,
                filter=active_filter,
            )
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Output formatting complete."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error formatting output."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Output formatting completed successfully.",
            data={
                "stream_url": stream_url,
                "output_format": output_format,
                "resolution": resolution,
            },
        )
