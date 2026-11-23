import os
import json

from director.llm.openai import OpenAIChatModel
from director.utils.keys import get_key


def composio_tool(task: str):
    from composio_openai import ComposioToolSet
    from openai import OpenAI

    key = get_key("OPENAI_API_KEY")
    base_url = "https://api.openai.com/v1"

    if not key:
        key = get_key("VIDEO_DB_API_KEY")
        base_url = os.getenv("VIDEO_DB_BASE_URL", "https://api.videodb.io")

    openai_client = OpenAI(api_key=key, base_url=base_url)

    toolset = ComposioToolSet(api_key=get_key("COMPOSIO_API_KEY"))
    tools = toolset.get_tools(apps=json.loads(os.getenv("COMPOSIO_APPS")))
    print(tools)

    response = openai_client.chat.completions.create(
        model=OpenAIChatModel.GPT4o,
        tools=tools,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": task},
        ],
    )

    composio_response = toolset.handle_tool_calls(response=response)
    if composio_response:
        return composio_response
    else:
        return response.choices[0].message.content or ""
