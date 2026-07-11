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

COMPILATION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID containing the videos to compile",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to compile into one video",
        },
        "transition": {
            "type": "string",
            "description": "Transition effect between clips",
            "enum": ["none", "fade", "dissolve", "wipe"],
            "default": "none",
        },
        "transition_duration": {
            "type": "number",
            "description": "Duration of each transition in seconds",
            "default": 0.5,
        },
    },
    "required": ["collection_id", "video_ids"],
}


class CompilationAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "compilation"
        self.description = "Compile multiple videos into one continuous video"
        self.parameters = COMPILATION_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_ids: list,
        transition: str = "none",
        transition_duration: float = 0.5,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Compile multiple videos into one.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs to compile.
        :param str transition: Transition effect between clips.
        :param float transition_duration: Duration of each transition.
        :return: The response with the compiled stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Transition

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Compiling videos..")
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

            for idx, vid in enumerate(video_ids):
                video_info = videodb_tool.get_video(vid)
                video_duration = video_info.get("length", 30)

                trans = None
                if transition != "none" and idx > 0:
                    trans = Transition(in_=transition, out=transition, duration=transition_duration)

                clip = Clip(
                    asset=VideoAsset(id=vid),
                    duration=video_duration,
                    transition=trans,
                )
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
            message=f"Compilation completed with {len(video_ids)} videos.",
            data={"stream_url": stream_url, "video_count": len(video_ids)},
        )
