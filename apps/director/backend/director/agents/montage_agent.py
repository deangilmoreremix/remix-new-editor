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

MONTAGE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID containing the videos to montage",
        },
        "video_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of video IDs to include in the montage",
        },
        "clip_duration": {
            "type": "integer",
            "description": "Duration of each montage clip segment in seconds",
            "default": 3,
        },
        "background_music_audio_id": {
            "type": "string",
            "description": "Optional audio ID for background music",
            "default": None,
        },
    },
    "required": ["collection_id", "video_ids"],
}


class MontageAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "montage"
        self.description = "Create a video montage from multiple clips with optional music"
        self.parameters = MONTAGE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_ids: list,
        clip_duration: int = 3,
        background_music_audio_id: str = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Build a montage video.

        :param str collection_id: The collection ID to use.
        :param list[str] video_ids: List of video IDs for montage.
        :param int clip_duration: Duration of each montage segment in seconds.
        :param str background_music_audio_id: Optional audio ID for bg music.
        :return: The response with the montage stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset, Filter, Transition

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Building montage..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating montage..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            timeline.background = "#000000"
            video_track = Track()
            audio_track = Track()

            current_time = 0
            for vid in video_ids:
                video_info = videodb_tool.get_video(vid)
                video_length = video_info.get("length", 30)
                start_time = max(0, video_length / 2 - clip_duration / 2)

                montage_clip = Clip(
                    asset=VideoAsset(id=vid, start=start_time),
                    duration=clip_duration,
                    filter=Filter.contrast,
                    transition=Transition(in_="fade", out="fade", duration=0.5),
                )
                video_track.add_clip(current_time, montage_clip)
                current_time += clip_duration

            timeline.add_track(video_track)

            if background_music_audio_id:
                music_clip = Clip(
                    asset=AudioAsset(id=background_music_audio_id, start=0, volume=0.5),
                    duration=current_time,
                )
                audio_track.add_clip(0, music_clip)
                timeline.add_track(audio_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Montage ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error building montage."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Video montage created successfully.",
            data={"stream_url": stream_url, "clip_count": len(video_ids)},
        )
