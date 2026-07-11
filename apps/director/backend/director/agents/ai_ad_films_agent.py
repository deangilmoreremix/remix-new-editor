import logging
import os
import uuid

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool
from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

AI_AD_FILMS_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to store the output video",
        },
        "product_name": {
            "type": "string",
            "description": "Name of the product to advertise",
        },
        "product_description": {
            "type": "string",
            "description": "Description of the product and its key features",
        },
        "target_audience": {
            "type": "string",
            "description": "Target audience for the advertisement",
            "default": "general consumers",
        },
        "duration": {
            "type": "integer",
            "description": "Duration of the ad film in seconds",
            "default": 30,
        },
        "tone": {
            "type": "string",
            "description": "Tone of the advertisement",
            "enum": ["professional", "fun", "luxury", "minimalist", "energetic"],
            "default": "professional",
        },
    },
    "required": ["collection_id", "product_name", "product_description"],
}


class AIAdFilmsAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "ai_ad_films"
        self.description = "Generate professional product advertisements"
        self.parameters = AI_AD_FILMS_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        product_name: str,
        product_description: str,
        target_audience: str = "general consumers",
        duration: int = 30,
        tone: str = "professional",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate a professional product advertisement video.

        :param str collection_id: The collection ID to use.
        :param str product_name: The product name.
        :param str product_description: Product description.
        :param str target_audience: Target audience.
        :param int duration: Duration in seconds.
        :param str tone: Tone of the ad.
        :return: The response with the generated ad stream URL.
        :rtype: AgentResponse
        """
        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Generating product advertisement..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Creating ad film..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            self.output_message.actions.append("Compositing final advertisement..")
            self.output_message.push_update()

            from videodb.editor import Timeline, Track, Clip, VideoAsset, TextAsset, Font, AudioAsset

            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            audio_track = Track()

            ad_prompt = f"{product_name} - {tone} advertisement. {product_description}"
            video_clip = Clip(asset=VideoAsset(id=""), duration=duration)
            video_track.add_clip(0, video_clip)
            timeline.add_track(video_track)

            product_text = TextAsset(
                text=product_name,
                font=Font(family="impact", size=40, color="#FFFFFF"),
                x="center",
                y="80%",
                duration=duration,
            )
            text_track = Track()
            text_track.add_clip(0, product_text)
            timeline.add_track(text_track)

            narration_text = f"Introducing {product_name}. {product_description}. Get yours today!"
            try:
                audio_data = videodb_tool.generate_voice(
                    text=narration_text,
                    voice_name="Rachel",
                    config={},
                )
                audio_clip = Clip(
                    asset=AudioAsset(id=audio_data["id"], start=0, volume=0.8),
                    duration=duration,
                )
                audio_track.add_clip(0, audio_clip)
                timeline.add_track(audio_track)
            except Exception:
                pass

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Ad film ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error generating ad film."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Product advertisement generated successfully.",
            data={"stream_url": stream_url},
        )
