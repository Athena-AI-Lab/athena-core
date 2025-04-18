# Configuration Guide

## Overview

Athena is highly configurable through the `config.yaml` file. This guide provides a comprehensive overview of the available configuration options and their usage.

For a complete example of configuration options, please refer to the [Configuration Template File](../configs/config.yaml-template).

## Global Configuration

```yaml
states_file: configs/states.yaml
log_file: configs/athena-core.log
workdir: /path/to/your/workdir
quiet: false
```

- `states_file`: The file to store and load Athena's state. If set, Athena will save its state to this file when shutting down and load it when starting to resume context and states.
- `log_file`: The file to store Athena's logs.
- `workdir`: Athena's working directory.
- `quiet`: Whether to run Athena in quiet mode. If set to `true`, Athena will not print logs to the console.

## Plugins Configuration

Plugins are the core components of Athena. Each plugin has its own configuration options. To load a plugin, simply include the plugin's name in the `plugins` section with its specific configuration options.

### Browser

The `browser` plugin allows Athena to control a web browser via Playwright.

```yaml
  browser:
    headless: true
```

- `headless`: Whether to run the browser in headless mode. If set to `true`, the browser will not be visible.

### Cerebrum

The `cerebrum` plugin is the main plugin for Athena. It handles event receiving, decision making, and tool calling.

Here is a configuration example for the cerebrum plugin using GPT-4o:

```yaml
  cerebrum:
    base_url: https://api.openai.com/v1
    api_key: sk-proj-your-openai-api-key
    model: gpt-4o
    temperature: 0.5
    image_supported: true
    max_prompts: 50
    max_event_strlen: 65536
    max_tokens: 16384
```

However, Athena performs best with DeepSeek V3 (not 0324). The web app version of Athena uses DeepSeek V3 as its cerebrum model. Here is an example configuration for DeepSeek V3:

```yaml
  cerebrum:
    base_url: https://openrouter.ai/api/v1
    api_key: sk-your-openrouter-api-key
    model: deepseek/deepseek-chat
    temperature: 0.5
    image_supported: false
    max_prompts: 50
    max_event_strlen: 65536
    max_tokens: 16384
```

Although more expensive, Athena can perform even better with Claude 3.7 Sonnet. Here is an example configuration:

```yaml
  cerebrum:
    base_url: https://api.anthropic.com/v1
    api_key: sk-ant-api03-your-anthropic-api-key
    model: claude-3-7-sonnet-latest
    temperature: 0.5
    image_supported: false
    max_prompts: 50
    max_event_strlen: 65536
    max_tokens: 16384
```

- `base_url`: The base URL of the API endpoint.
- `api_key`: The API key for the endpoint.
- `model`: The model to use.
- `temperature`: The temperature setting.
- `image_supported`: Whether the model supports images. Currently, only set to `true` for GPT-4o.
- `max_prompts`: The maximum number of prompts kept in the context sent to the model.
- `max_event_strlen`: The maximum allowed length of any string in events or tool results sent to the model.
- `max_tokens`: The maximum number of tokens in the response for each model call.

### CLI UI

Enable `cli-ui` to interact with Athena via the command line. If not needed, you can remove it from the `plugins` section.

```yaml
  cli-ui:
```

### Clock

The `clock` plugin provides time awareness and scheduling. When enabled, Athena can get the current date and time, and manage timers and alarms.

```yaml
  clock:
```

### Discord

Enable `discord` for Athena to send and receive messages from Discord.

```yaml
  discord:
    bot_token: your-discord-bot-token
    allowed_channel_ids:
      - "1234567890"
      - "9876543210"
    admin_channel_ids: []
    log_channel_ids: []
```

- `bot_token`: The Discord bot token.
- `allowed_channel_ids`: IDs of channels Athena is allowed to interact with. Values must be a list of strings.
- `admin_channel_ids`: If set, Athena will send debug logs to these channels. Values must be a list of strings.
- `log_channel_ids`: If set, Athena will send thinking and tool calling logs to these channels. Values must be a list of strings.

### File System

Enable `file-system` to allow Athena to access your local file system. Athena will be able to read and write files.

```yaml
  file-system:
```

### HTTP

Enable `http` for Athena to send HTTP requests, search the web via Jina Search or Exa Search, and download files from the Internet.

```yaml
  http:
    jina: # Optional Jina config
      base_url: https://s.jina.ai
      api_key: your-jina-api-key
    exa: # Optional Exa config
      base_url: https://api.exa.ai # Optional, defaults to this
      api_key: your-exa-api-key   # Required if using Exa
```

- `jina`: Configuration for [Jina Search](https://jina.ai/). (Optional)
  - `base_url`: The base URL of the Jina Search API endpoint. (Optional, defaults to `https://s.jina.ai`)
  - `api_key`: The API key for the Jina Search API endpoint. (Required if using Jina)
- `exa`: Configuration for [Exa Search](https://exa.ai/). (Optional)
  - `base_url`: The base URL of the Exa Search API endpoint. (Optional, defaults to `https://api.exa.ai`)
  - `api_key`: The API key for the Exa Search API endpoint. (Required if using Exa)

### LLM

Enable `llm` for Athena to chat with other language models and generate images.

Since only a single OpenAI endpoint can be configured currently, it's recommended to use a service like LiteLLM proxy to route requests to different language models. OpenRouter is another option, though it doesn't support image generation.
 
```yaml
  llm:
    base_url: https://openrouter.ai/api/v1
    api_key: sk-or-v1-your-openrouter-api-key
    models:
      chat:
        - name: openai/gpt-4o
          desc: GPT-4o is good at general purpose tasks. Supports image input. Whenever you receive an image and need to understand it, pass it to this model using the image arg.
        - name: openai/o3-mini
          desc: O3 Mini is good at deep thinking and planning. Whenever you need to plan something complicated or solve complex math problems, use this model.
        - name: anthropic/claude-3.7-sonnet
          desc: Claude 3.7 Sonnet is good at writing code. Whenever you need to write code, use this model.
        - name: perplexity/sonar
          desc: Perplexity can access the Internet. Whenever you need to search the Internet, use this model.
      image:
        - name: openai/dall-e-3 # OpenRouter doesn't support image generation
          desc: DALL-E 3 is good at generating images. Whenever you are requested to generate images, use this model.
```

- `base_url`: The base URL of the API endpoint.
- `api_key`: The API key for the endpoint.
- `models`: The models available for use.
  - `chat`: The chat models available.
    - `name`: The name of the model.
    - `desc`: The description of the model.
  - `image`: The image generation models available.
    - `name`: The name of the model.
    - `desc`: The description of the model.

### Python

Enable `python` for Athena to run inline Python code or Python scripts. This also enables Athena to install pip packages.

```yaml
  python:
```

### Shell

Enable `shell` for Athena to run shell commands.

```yaml
  shell:
```

### Short-Term Memory

Enable `short-term-memory` for Athena to manage a basic task list.

```yaml
  short-term-memory:
```

### Telegram

Enable `telegram` for Athena to send and receive messages from Telegram.

```yaml
  telegram:
    bot_token: your-telegram-bot-token
    allowed_chat_ids:
      - 1234567890
      - 9876543210
    admin_chat_ids: []
    log_chat_ids: []
```

- `bot_token`: The Telegram bot token.
- `allowed_chat_ids`: IDs of chats Athena is allowed to interact with.
- `admin_chat_ids`: If set, Athena will send debug logs to these chats.
- `log_chat_ids`: If set, Athena will send thinking and tool calling logs to these chats.
