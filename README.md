<a name="banner"><img src="https://cdn.jsdelivr.net/gh/tsdotnet/websocket-connector@master/assets/banner.svg" alt="@tsdotnet/websocket-connector: Many streams, one socket. Pooled WebSockets for Node and browser."></a>

[![npm version](https://img.shields.io/npm/v/@tsdotnet/websocket-connector.svg?style=flat-square)](https://www.npmjs.com/package/@tsdotnet/websocket-connector)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/tsdotnet/websocket-connector/blob/master/LICENSE)

Many virtual connections share one pooled WebSocket, in Node, the browser or a mock.

## Install

```sh
npm install @tsdotnet/websocket-connector
```

## Usage

```ts
import { NodeWebSocketConnector } from '@tsdotnet/websocket-connector';

const connector = new NodeWebSocketConnector('wss://example.com/ws');
const a = await connector.connect(); // opens the one real socket
const b = await connector.connect(); // shares it
a.subscribe(message => console.log(message));
await b.send('hello');
```

Use `BrowserWebSocketConnector` from `@tsdotnet/websocket-connector/browser` in the browser and `MockWebSocketConnector` from `@tsdotnet/websocket-connector/mock` in tests.

## Use it from

ESM (`import { NodeWebSocketConnector } from '@tsdotnet/websocket-connector';`) or CommonJS (`const { NodeWebSocketConnector } = require('@tsdotnet/websocket-connector');`). No `<script>` (UMD) build: use it with a bundler or Node.js.

## Docs

[tsdotnet.github.io/websocket-connector](https://tsdotnet.github.io/websocket-connector/)
