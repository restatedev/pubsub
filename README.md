## 🚀 Quick Start

### Create a new project 

```sh
bun init .
bun add "@restatedev/pubsub"
bun add "@restatedev/restate-sdk"
```

### Replace the content of index.ts
```ts
import {createPubsubObject} from "@restatedev/pubsub";
import {serve} from "@restatedev/restate-sdk";

const pubsub = createPubsubObject("sessions", {});

serve({
  services: [pubsub],
});
```

### Start the service
```sh
bun run index.ts
```
### After successfully registering this with the restate server, you can produce and consume from any topic, by interacting
with the 'sessions' virtual object.

For example:

```sh
curl --request POST \
  --url http://127.0.0.1:8080/sessions/123/publish \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '"hello world"'
```

Or pull for new messages 

```sh
curl --request POST \
  --url http://127.0.0.1:8080/sessions/123/pull \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{ "offset" : 0 }'
```

Or use the pubsub client to consume an SSE stream:

```sh
bun add "@restatedev/pubsub-client"
```

```typescript
// sse.ts

import { createPubsubClient } from "@restatedev/pubsub-client";

const pubsub = createPubsubClient({
  ingressUrl: "http://localhost:8080",
  name: "sessions", // <-- same as your pubsub virtual object above.
});

Bun.serve({
  port: 3000,
  fetch(request) {
    const stream = pubsub.sse({ topic: "123" })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  },
});

```

And then:

```sh
curl http://localhost:3000/sse
event: ping
data: "hello"

data: "world"

data: "bla"

```

## 🛠 Contributing

Please see the [Development Guide](./DEVELOPMENT.md) for setup instructions, testing, linting, and release workflow.
