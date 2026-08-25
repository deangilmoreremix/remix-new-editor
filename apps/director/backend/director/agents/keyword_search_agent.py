import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool
from videodb import IndexType

logger = logging.getLogger(__name__)

KEYWORD_SEARCH_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "The collection ID to search within",
        },
        "query": {
            "type": "string",
            "description": "Keyword or phrase to search for across videos",
        },
        "compile": {
            "type": "boolean",
            "description": "Whether to stitch matched moments into a single compilation",
            "default": True,
        },
    },
    "required": ["collection_id", "query"],
}


class KeywordSearchAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "keyword_search"
        self.description = (
            "Searches videos by keyword and compiles the matching moments into a clip. "
            "Use when a user wants to find a specific word or phrase and build a highlight reel."
        )
        self.parameters = KEYWORD_SEARCH_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, query: str, compile: bool = True, *args, **kwargs):
        try:
            self.output_message.actions.append(f"Searching for '{query}'...")
            self.output_message.push_update()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Searching videos...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            results = videodb_tool.keyword_search(
                query=query, index_type=IndexType.spoken_word
            )

            stream_url = None
            if compile and results:
                from videodb.editor import Timeline, Track, Clip, VideoAsset
                timeline = Timeline(videodb_tool.conn)
                track = Track()
                shots = results.get_shots() if hasattr(results, "get_shots") else []
                start = 0
                for shot in shots:
                    clip = Clip(
                        asset=VideoAsset(id=shot.video_id, start=int(shot.start)),
                        duration=int(shot.end - shot.start),
                    )
                    track.add_clip(start, clip)
                    start += int(shot.end - shot.start)
                timeline.add_track(track)
                if shots:
                    stream_url = timeline.generate_stream()

            video_content.status = MsgStatus.success
            video_content.status_message = "Search complete."
            if stream_url:
                video_content.video = VideoData(stream_url=stream_url)
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error performing keyword search."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Keyword search completed.",
            data={"stream_url": stream_url} if stream_url else {"results": str(results)},
        )
