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

TRAILER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to include in the trailer",
        },
        "trailer_duration": {
            "type": "integer",
            "description": "Target duration of the trailer in seconds",
            "default": 60,
        },
        "style": {
            "type": "string",
            "description": "Cinematic style for the trailer",
            "enum": ["epic", "dramatic", "action", "emotional", "mystery"],
            "default": "epic",
        },
        "transition": {
            "type": "string",
            "description": "Transition effect between clips",
            "enum": ["none", "fade", "dissolve", "wipe"],
            "default": "fade",
        },
        "add_intro": {
            "type": "boolean",
            "description": "Whether to add a cinematic intro card",
            "default": True,
        },
        "add_outro": {
            "type": "boolean",
            "description": "Whether to add a cinematic outro card",
            "default": True,
        },
    },
    "required": ["collection_id", "video_ids"],
}


class TrailerAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "trailer"
        self.description = "Build cinematic trailers from video clips"
        self.parameters = TRAILER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_ids: list,
        trailer_duration: int = 60,
        style: str = "epic",
        transition: str = "fade",
        add_intro: bool = True,
        add_outro: bool = True,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Build a cinematic trailer from video clips.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs.
        :param int trailer_duration: Target trailer duration.
        :param str style: Cinematic style.
        :param str transition: Transition effect.
        :param bool add_intro: Whether to add intro card.
        :param bool add_outro: Whether to add outro card.
        :return: The response with the trailer stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, Transition, TextAsset, Font

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Building cinematic trailer..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Compositing trailer..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            text_track = Track()

            total_time = 0
            intro_duration = 3
            outro_duration = 3
            available_duration = trailer_duration - intro_duration - outro_duration
            clip_duration = available_duration / max(len(video_ids), 1)

            if add_intro:
                intro_font = Font(family="impact", size=60, color="#FFFFFF")
                intro_text = TextAsset(
                    text=style.upper(),
                    font=intro_font,
                    x="center",
                    y="center",
                    duration=intro_duration,
                )
                text_track.add_clip(0, intro_text)
                total_time = intro_duration

            for idx, vid in enumerate(video_ids):
                video_info = videodb_tool.get_video(vid)
                video_length = video_info.get("length", 30)
                usable_duration = min(clip_duration, video_length)

                trans = None
                if transition != "none" and idx > 0:
                    trans = Transition(in_=transition, out=transition, duration=0.5)

                video_clip = Clip(
                    asset=VideoAsset(id=vid, start=0),
                    duration=usable_duration,
                    transition=trans,
                )
                video_track.add_clip(total_time, video_clip)
                total_time += usable_duration

            timeline.add_track(video_track)
            timeline.add_track(text_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Trailer ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error building trailer."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Trailer created successfully.",
            data={"stream_url": stream_url},
        )
