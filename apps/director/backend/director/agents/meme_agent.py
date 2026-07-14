import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

MEME_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to turn into a meme"},
        "top_text": {"type": "string", "description": "Top caption text", "default": None},
        "bottom_text": {"type": "string", "description": "Bottom caption text", "default": None},
    },
    "required": ["collection_id", "video_id"],
}


class MemeAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "meme"
        self.description = "Turns a video into a meme by overlaying top/bottom caption text."
        self.parameters = MEME_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, top_text: str = None, bottom_text: str = None,
             *args, **kwargs):
        try:
            self.output_message.actions.append("Building meme...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset, TextAsset, Font, Background, Alignment, HorizontalAlignment, VerticalAlignment

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Composing meme...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            video = videodb_tool.get_video(video_id)
            duration = float(video.get("length", 30))

            timeline = Timeline(videodb_tool.conn)
            track = Track()
            track.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0), duration=duration))
            timeline.add_track(track)

            overlay = Track()
            if top_text:
                overlay.add_clip(0, Clip(
                    asset=TextAsset(
                        text=top_text,
                        font=Font(family="Clear Sans", size=48, color="#FFFFFF", weight=700),
                        background=Background(color="#000000", border_width=4, opacity=0.85),
                        alignment=Alignment(horizontal=HorizontalAlignment.center, vertical=VerticalAlignment.top),
                    ),
                    duration=duration, position="top",
                ))
            if bottom_text:
                overlay.add_clip(0, Clip(
                    asset=TextAsset(
                        text=bottom_text,
                        font=Font(family="Clear Sans", size=48, color="#FFFFFF", weight=700),
                        background=Background(color="#000000", border_width=4, opacity=0.85),
                        alignment=Alignment(horizontal=HorizontalAlignment.center, vertical=VerticalAlignment.bottom),
                    ),
                    duration=duration, position="bottom",
                ))
            timeline.add_track(overlay)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Meme ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Meme failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Meme created.",
                                 data={"stream_url": stream_url})
