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

MUSICVIDEO_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to include in the music video",
        },
        "audio_id": {
            "type": "string",
            "description": "Audio ID for the music track",
        },
        "transition": {
            "type": "string",
            "description": "Transition effect between clips",
            "enum": ["none", "fade", "dissolve", "wipe"],
            "default": "fade",
        },
        "beat_sync": {
            "type": "boolean",
            "description": "Whether to sync transitions to audio beats",
            "default": True,
        },
    },
    "required": ["collection_id", "video_ids", "audio_id"],
}


class MusicVideoAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "musicvideo"
        self.description = "Generate music videos synced to music from video clips"
        self.parameters = MUSICVIDEO_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_ids: list,
        audio_id: str,
        transition: str = "fade",
        beat_sync: bool = True,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate a music video synced to music.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs.
        :param str audio_id: The audio ID for the music.
        :param str transition: Transition effect.
        :param bool beat_sync: Whether to sync to beats.
        :return: The response with the music video stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset, Transition

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            audio_info = videodb_tool.get_audio(audio_id)
            audio_duration = audio_info.get("length", 60)

            self.output_message.actions.append("Building music video..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Compositing music video..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            audio_track = Track()

            total_video_duration = 0
            clip_duration = audio_duration / max(len(video_ids), 1)

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
                video_track.add_clip(total_video_duration, video_clip)
                total_video_duration += usable_duration

            timeline.add_track(video_track)

            music_clip = Clip(
                asset=AudioAsset(id=audio_id, start=0, volume=0.7),
                duration=total_video_duration,
            )
            audio_track.add_clip(0, music_clip)
            timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Music video ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error creating music video."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Music video generated successfully.",
            data={"stream_url": stream_url},
        )
