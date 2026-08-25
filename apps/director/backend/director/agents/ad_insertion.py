import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

AD_INSERTION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "The base video ID to insert the ad into",
        },
        "collection_id": {
            "type": "string",
            "description": "The collection ID containing the videos",
        },
        "ad_video_id": {
            "type": "string",
            "description": "The video ID of the ad to insert",
        },
        "insert_time": {
            "type": "number",
            "description": "Timestamp in seconds where the ad should be inserted",
        },
    },
    "required": ["video_id", "collection_id", "ad_video_id", "insert_time"],
}


class AdInsertionAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "ad_insertion"
        self.description = (
            "Inserts advertisement or announcement videos at specific timestamps "
            "within a base video. Splits the base video into segments and weaves "
            "in the ad seamlessly. Perfect for dynamic ad insertion, announcements, "
            "and personalized video streams."
        )
        self.parameters = AD_INSERTION_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        video_id: str,
        collection_id: str,
        ad_video_id: str,
        insert_time: float,
        *args,
        **kwargs,
    ) -> AgentResponse:
        try:
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Inserting ad...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            from videodb.editor import Timeline, Track, Clip, VideoAsset

            base_video = self.videodb_tool.get_video(video_id)
            ad_video = self.videodb_tool.get_video(ad_video_id)

            base_duration = float(base_video.get("length", 0))
            ad_duration = float(ad_video.get("length", 0))

            if insert_time <= 0 or insert_time >= base_duration:
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message=f"Insert time {insert_time}s is outside the valid range (0 to {base_duration}s).",
                )

            timeline = Timeline(self.videodb_tool.conn)
            track = Track()

            clip1 = Clip(
                asset=VideoAsset(id=video_id),
                duration=insert_time,
            )
            track.add_clip(0, clip1)

            clip2 = Clip(
                asset=VideoAsset(id=ad_video_id),
                duration=ad_duration,
            )
            track.add_clip(insert_time, clip2)

            clip3 = Clip(
                asset=VideoAsset(id=video_id, start=insert_time),
                duration=base_duration - insert_time,
            )
            track.add_clip(insert_time + ad_duration, clip3)

            timeline.add_track(track)
            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Ad inserted successfully!"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to insert ad."
            self.output_message.publish()
            return AgentResponse(
                status=AgentStatus.ERROR,
                message=f"Failed to insert ad: {str(e)}",
            )

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Ad inserted successfully.",
            data={
                "stream_url": stream_url,
                "insert_time": insert_time,
                "ad_duration": ad_duration,
            },
        )
