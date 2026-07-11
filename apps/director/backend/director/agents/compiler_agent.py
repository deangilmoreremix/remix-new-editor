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

COMPILER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID containing the videos to compile",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to compile",
        },
        "output_name": {
            "type": "string",
            "description": "Optional name for the compiled output video",
            "default": "compiled_video",
        },
    },
    "required": ["collection_id", "video_ids"],
}


class CompilerAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "compiler"
        self.description = "Compile multiple videos into one final output"
        self.parameters = COMPILER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_ids: list,
        output_name: str = "compiled_video",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Compile multiple videos into one output.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs to compile.
        :param str output_name: Name for the compiled output.
        :return: The response with the compiled stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Compiling content..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Compiling videos..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            track = Track()
            current_time = 0

            for vid in video_ids:
                video_info = videodb_tool.get_video(vid)
                video_duration = video_info.get("length", 30)
                clip = Clip(asset=VideoAsset(id=vid), duration=video_duration)
                track.add_clip(current_time, clip)
                current_time += video_duration

            timeline.add_track(track)
            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Compilation ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error in compilation."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Content compiled successfully: {output_name}",
            data={"stream_url": stream_url, "output_name": output_name, "clip_count": len(video_ids)},
        )
