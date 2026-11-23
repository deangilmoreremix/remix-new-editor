import os

from slack_sdk import WebClient
from director.utils.keys import get_key


def send_message_to_channel(message, channel_name):
    slack_token = get_key("SLACK_BOT_TOKEN")
    slack_client = WebClient(token=slack_token)
    response = slack_client.chat_postMessage(channel=channel_name, text=message)
    return response
