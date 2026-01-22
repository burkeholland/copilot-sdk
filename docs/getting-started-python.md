# Build Your First Copilot-Powered App with Python

In this tutorial, you'll use the Copilot SDK to build a command-line assistant. You'll start with the basics, add streaming responses, then add custom tools - giving Copilot the ability to call your code.

**What you'll build:**

```
You: What's the weather like in Seattle?
Copilot: Let me check the weather for Seattle...
         Currently 62°F and cloudy with a chance of rain.
         Typical Seattle weather!

You: How about Tokyo?
Copilot: In Tokyo it's 75°F and sunny. Great day to be outside!
```

## Prerequisites

Before you begin, make sure you have:

- **GitHub CLI** installed ([Installation guide](https://cli.github.com/))
- **GitHub Copilot CLI** extension installed ([Installation guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli))
- **Python** 3.8+

Authenticate with GitHub (required before using the SDK):

```bash
gh auth login
```

Verify the Copilot CLI is working:

```bash
copilot --version
```

## Step 1: Install the SDK

```bash
pip install github-copilot-sdk
```

## Step 2: Send Your First Message

Create a new file and add the following code. This is the simplest way to use the SDK.

Create `main.py`:

```python
import asyncio
from copilot import CopilotClient

async def main():
    client = CopilotClient()
    await client.start()

    session = await client.create_session({"model": "gpt-5-mini"})
    response = await session.send_and_wait({"prompt": "What is 2 + 2?"})

    print(response.data.content)

    await client.stop()

asyncio.run(main())
```

Run it:

```bash
python main.py
```

**You should see:**

```
4
```

Congratulations! You just built your first Copilot-powered app.

## Step 3: Add Streaming Responses

Right now, you wait for the complete response before seeing anything. Let's make it interactive by streaming the response as it's generated.

Update `main.py`:

```python
import asyncio
import sys
from copilot import CopilotClient
from copilot.generated.session_events import SessionEventType

async def main():
    client = CopilotClient()
    await client.start()

    session = await client.create_session({
        "model": "gpt-5-mini",
        "streaming": True,
    })

    done = asyncio.Event()

    # Listen for response chunks
    def handle_event(event):
        if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
            sys.stdout.write(event.data.delta_content)
            sys.stdout.flush()
        if event.type == SessionEventType.SESSION_IDLE:
            print()  # New line when done
            done.set()

    session.on(handle_event)

    # send() returns immediately - responses come through the event handler
    await session.send({"prompt": "Tell me a short joke"})
    await done.wait()

    await client.stop()

asyncio.run(main())
```

Run the code again. You'll see the response appear word by word.

> **`send` vs `send_and_wait`**: The `send` method returns immediately after sending the message, letting you handle the response entirely through events. Use `send_and_wait` (from Step 2) when you want to block until the response is complete—it's a convenience wrapper that waits for the `session.idle` event.

## Step 4: Add a Custom Tool

Now for the powerful part. Let's give Copilot the ability to call your code by defining a custom tool. We'll create a simple weather lookup tool.

Update `main.py`:

```python
import asyncio
import random
import sys
from pydantic import BaseModel, Field
from copilot import CopilotClient, define_tool
from copilot.generated.session_events import SessionEventType

# Define the parameters using Pydantic
class WeatherParams(BaseModel):
    city: str = Field(description="The city name")

# Define a tool that Copilot can call
@define_tool(description="Get the current weather for a city")
def get_weather(params: WeatherParams) -> dict:
    # In a real app, you'd call a weather API here
    conditions = ["sunny", "cloudy", "rainy", "partly cloudy"]
    temp = random.randint(50, 80)
    condition = random.choice(conditions)
    return {"city": params.city, "temperature": f"{temp}°F", "condition": condition}

async def main():
    client = CopilotClient()
    await client.start()

    session = await client.create_session({
        "model": "gpt-5-mini",
        "streaming": True,
        "tools": [get_weather],
        "available_tools": ["get_weather"]
    })

    def handle_event(event):
        if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
            sys.stdout.write(event.data.delta_content)
            sys.stdout.flush()
        if event.type == SessionEventType.SESSION_IDLE:
            print()

    session.on(handle_event)

    await session.send_and_wait({
        "prompt": "What's the weather like in Seattle and Tokyo?"
    })

    await client.stop()

asyncio.run(main())
```

Run it and you'll see Copilot call your tool to get weather data, then respond with the results!

## Step 5: Build an Interactive Assistant

Let's put it all together into a useful interactive assistant:

Create `weather_assistant.py`:

```python
import asyncio
import random
import sys
from pydantic import BaseModel, Field
from copilot import CopilotClient, define_tool
from copilot.generated.session_events import SessionEventType

# Define the parameters using Pydantic
class WeatherParams(BaseModel):
    city: str = Field(description="The city name")

@define_tool(description="Get the current weather for a city")
def get_weather(params: WeatherParams) -> dict:
    conditions = ["sunny", "cloudy", "rainy", "partly cloudy"]
    temp = random.randint(50, 80)
    condition = random.choice(conditions)
    return {"city": params.city, "temperature": f"{temp}°F", "condition": condition}

async def main():
    client = CopilotClient()
    await client.start()

    session = await client.create_session({
        "model": "gpt-5-mini",
        "streaming": True,
        "tools": [get_weather],
        "available_tools": ["get_weather"],
    })

    def handle_event(event):
        if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
            sys.stdout.write(event.data.delta_content)
            sys.stdout.flush()

    session.on(handle_event)

    print("🌤️  Weather Assistant (type 'exit' to quit)")
    print("   Try: 'What's the weather in Paris?' or 'Compare weather in NYC and LA'\n")

    while True:
        try:
            user_input = input("You: ")
        except EOFError:
            break

        if user_input.lower() == "exit":
            break

        sys.stdout.write("Assistant: ")
        await session.send_and_wait({"prompt": user_input})
        print("\n")

    await client.stop()

asyncio.run(main())
```

Run with:

```bash
python weather_assistant.py
```

**Example session:**

```
🌤️  Weather Assistant (type 'exit' to quit)
   Try: 'What's the weather in Paris?' or 'Compare weather in NYC and LA'

You: What's the weather in Seattle?
Assistant: Let me check the weather for Seattle...
It's currently 62°F and cloudy in Seattle.

You: How about Tokyo and London?
Assistant: I'll check both cities for you:
- Tokyo: 75°F and sunny
- London: 58°F and rainy

You: exit
```

You've built an assistant with a custom tool that Copilot can call!

---

## How Tools Work

When you define a tool, you're telling Copilot:
1. **What the tool does** (description)
2. **What parameters it needs** (Pydantic model)
3. **What code to run** (handler function)

Copilot decides when to call your tool based on the user's question. When it does:
1. Copilot sends a tool call request with the parameters
2. The SDK runs your handler function
3. The result is sent back to Copilot
4. Copilot incorporates the result into its response

---

## What's Next?

Now that you've got the basics, here are more powerful features to explore:

### Connect to MCP Servers

MCP (Model Context Protocol) servers provide pre-built tools. Connect to GitHub's MCP server to give Copilot access to repositories, issues, and pull requests:

```python
session = await client.create_session({
    "mcp_servers": {
        "github": {
            "type": "http",
            "url": "https://api.githubcopilot.com/mcp/",
        },
    },
})
```

### Create Custom Agents

Define specialized AI personas for specific tasks:

```python
session = await client.create_session({
    "custom_agents": [{
        "name": "pr-reviewer",
        "display_name": "PR Reviewer",
        "description": "Reviews pull requests for best practices",
        "prompt": "You are an expert code reviewer. Focus on security, performance, and maintainability.",
    }],
})
```

### Customize the System Message

Control the AI's behavior and personality:

```python
session = await client.create_session({
    "system_message": {
        "content": "You are a helpful assistant for our engineering team. Always be concise.",
    },
})
```

---

## Learn More

- [Python SDK Reference](../python/README.md)
- [GitHub MCP Server Documentation](https://github.com/github/github-mcp-server)
- [MCP Servers Directory](https://github.com/modelcontextprotocol/servers) - Explore more MCP servers

---

**You did it!** You've learned the core concepts of the GitHub Copilot SDK:
- ✅ Creating a client and session
- ✅ Sending messages and receiving responses
- ✅ Streaming for real-time output
- ✅ Defining custom tools that Copilot can call

Now go build something amazing! 🚀
