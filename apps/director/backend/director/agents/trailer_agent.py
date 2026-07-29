import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

TRAILER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to build a trailer from"},
        "duration": {"type": "integer", "description": "Trailer length in seconds", "default": 30},
    },
    "required": ["collection_id", "video_id"],
}


class TrailerAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "trailer"
        self.description = "Creates a cinematic trailer by extracting highlights from a video."
        self.parameters = TRAILER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, duration: int = 30, *args, **kwargs):
        try:
            self.output_message.actions.append("Building trailer...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset
            from videodb import IndexType, SceneExtractionType

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Composing trailer...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            videodb_tool.index_scene(video_id=video_id, extraction_type=SceneExtractionType.shot_based)
            scenes = videodb_tool.list_scene_index(video_id)

            timeline = Timeline(videodb_tool.conn)
            track = Track()
            start = 0
            total = 0
            for scene in scenes:
                if total >= duration:
                    break
                clip = Clip(asset=VideoAsset(id=video_id, start=int(scene.get("start_time", 0))),
                               duration=min(int(scene.get("end_time", 5)) - int(scene.get("start_time", 0)),
                                          duration - total))
                track.add_clip(start, clip)
                start += clip.duration
                total += clip.duration
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Trailer ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Trailer failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Trailer created.",
                                 data={"stream_url": stream_url})
