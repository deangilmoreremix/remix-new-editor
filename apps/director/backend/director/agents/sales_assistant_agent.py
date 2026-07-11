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

SALES_ASSISTANT_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "video_id": {
            "type": "string",
            "description": "Video ID to add sales elements to",
        },
        "product_name": {
            "type": "string",
            "description": "Name of the product being sold",
        },
        "call_to_action": {
            "type": "string",
            "description": "Call to action text to overlay",
            "default": "Buy Now!",
        },
        "price_text": {
            "type": "string",
            "description": "Price or offer text to display",
            "default": "",
        },
        "brand_color": {
            "type": "string",
            "description": "Brand color for text overlays",
            "default": "#FF0000",
        },
    },
    "required": ["collection_id", "video_id", "product_name"],
}


class SalesAssistantAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "sales_assistant"
        self.description = "Sales-focused video assistant for adding product promos, CTAs, and branding to videos"
        self.parameters = SALES_ASSISTANT_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        video_id: str,
        product_name: str,
        call_to_action: str = "Buy Now!",
        price_text: str = "",
        brand_color: str = "#FF0000",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Add sales elements to a video.

        :param str collection_id: The collection ID to use.
        :param str video_id: The video ID to add sales elements to.
        :param str product_name: Product name.
        :param str call_to_action: CTA text.
        :param str price_text: Price text.
        :param str brand_color: Brand color.
        :return: The response with the sales-enhanced stream URL.
        :rtype: AgentResponse
        """
        from videodb.editor import Timeline, Track, Clip, VideoAsset, TextAsset, Font

        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)
            video_info = videodb_tool.get_video(video_id)
            video_duration = video_info.get("length", 30)

            self.output_message.actions.append("Adding sales elements..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Adding product branding..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            timeline = Timeline(videodb_tool.conn)
            video_clip = Clip(asset=VideoAsset(id=video_id), duration=video_duration)
            track = Track()
            track.add_clip(0, video_clip)
            timeline.add_track(track)

            text_track = Track()
            product_font = Font(family="impact", size=36, color=brand_color)
            product_text = TextAsset(
                text=product_name,
                font=product_font,
                x="10%",
                y="10%",
                duration=video_duration,
            )
            text_track.add_clip(0, product_text)

            cta_font = Font(family="impact", size=48, color="#FFFFFF")
            cta_text = TextAsset(
                text=call_to_action,
                font=cta_font,
                x="center",
                y="80%",
                duration=video_duration,
            )
            text_track.add_clip(0, cta_text)

            if price_text:
                price_font = Font(family="impact", size=32, color="#FFD700")
                price_text_asset = TextAsset(
                    text=price_text,
                    font=price_font,
                    x="80%",
                    y="10%",
                    duration=video_duration,
                )
                text_track.add_clip(0, price_text_asset)

            timeline.add_track(text_track)

            stream_url = timeline.generate_stream()

            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Sales video ready."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error adding sales elements."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Sales elements added successfully.",
            data={"stream_url": stream_url},
        )
